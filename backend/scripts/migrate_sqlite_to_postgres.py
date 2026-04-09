from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass

from sqlalchemy import Boolean, MetaData, create_engine, func, select
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.sql.sqltypes import JSON

DEFAULT_SOURCE_URL = "sqlite:///./dev.db"


@dataclass
class TableMigrationStats:
    source_name: str
    target_name: str
    source_count: int
    inserted_count: int


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate data from SQLite to PostgreSQL.")
    parser.add_argument(
        "--source-url",
        default=os.getenv("SOURCE_DATABASE_URL", DEFAULT_SOURCE_URL),
        help=f"Source SQLite URL. Default: {DEFAULT_SOURCE_URL}",
    )
    parser.add_argument(
        "--target-url",
        default=os.getenv("TARGET_DATABASE_URL", os.getenv("DATABASE_URL", "")),
        help="Target PostgreSQL URL. Default: TARGET_DATABASE_URL or DATABASE_URL",
    )
    parser.add_argument(
        "--truncate-target",
        action="store_true",
        help="Truncate target tables before copy (destructive).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Insert batch size. Default: 500",
    )
    parser.add_argument(
        "--skip-table",
        action="append",
        default=[],
        help="Table name to skip. Can be used multiple times.",
    )
    return parser.parse_args()


def _ensure_valid_urls(source_url: str, target_url: str):
    if not target_url:
        raise ValueError("Target PostgreSQL URL is required (use --target-url or DATABASE_URL).")
    if source_url == target_url:
        raise ValueError("source-url and target-url cannot be the same.")


def _reflect(engine: Engine) -> MetaData:
    metadata = MetaData()
    metadata.reflect(bind=engine)
    return metadata


def _table_order(source_meta: MetaData, target_meta: MetaData, skip_tables: set[str]) -> list[tuple[str, str]]:
    source_tables = {name for name in source_meta.tables.keys() if not name.startswith("sqlite_")}
    source_tables = {name for name in source_tables if name not in skip_tables}

    target_names = list(target_meta.tables.keys())
    target_lower_map: dict[str, list[str]] = {}
    for name in target_names:
        key = name.lower()
        target_lower_map.setdefault(key, []).append(name)

    matched_pairs: list[tuple[str, str]] = []
    missing: list[str] = []
    ambiguous: list[tuple[str, list[str]]] = []

    for source_name in sorted(source_tables):
        if source_name in target_meta.tables:
            matched_pairs.append((source_name, source_name))
            continue

        candidates = target_lower_map.get(source_name.lower(), [])
        if len(candidates) == 1:
            matched_pairs.append((source_name, candidates[0]))
        elif len(candidates) > 1:
            ambiguous.append((source_name, candidates))
        else:
            missing.append(source_name)

    target_sort_index = {table.name: idx for idx, table in enumerate(target_meta.sorted_tables)}
    matched_pairs.sort(key=lambda pair: target_sort_index.get(pair[1], 10_000))

    if missing:
        print(f"[WARN] These source tables are missing in target schema and will be skipped: {missing}")
    if ambiguous:
        for source_name, candidates in ambiguous:
            print(f"[WARN] Ambiguous target table for source {source_name}: {candidates}. Skipped.")

    return matched_pairs


def _normalize_json(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, (bytes, bytearray)):
        value = value.decode("utf-8", errors="ignore")
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except Exception:
            return value
    return value


def _normalize_cell(value, column_type):
    if value is None:
        return None
    if isinstance(column_type, Boolean):
        return bool(value)
    if isinstance(column_type, JSON):
        return _normalize_json(value)
    return value


def _truncate_target_tables(target_conn: Connection, target_meta: MetaData, table_pairs: list[tuple[str, str]]):
    for _, target_name in reversed(table_pairs):
        if target_name not in target_meta.tables:
            continue
        target_conn.exec_driver_sql(f'TRUNCATE TABLE "{target_name}" RESTART IDENTITY CASCADE')
        print(f"[TRUNCATE] {target_name}")


def _copy_single_table(
    source_conn: Connection,
    target_conn: Connection,
    source_meta: MetaData,
    target_meta: MetaData,
    source_table_name: str,
    target_table_name: str,
    batch_size: int,
) -> TableMigrationStats:
    source_table = source_meta.tables[source_table_name]
    target_table = target_meta.tables[target_table_name]

    source_column_names = {col.name for col in source_table.columns}
    source_lower_to_actual = {col.name.lower(): col.name for col in source_table.columns}

    column_pairs: list[tuple[str, str]] = []
    for target_col in target_table.columns:
        target_col_name = target_col.name
        if target_col_name in source_column_names:
            column_pairs.append((target_col_name, target_col_name))
            continue
        lower_match = source_lower_to_actual.get(target_col_name.lower())
        if lower_match:
            column_pairs.append((lower_match, target_col_name))

    if not column_pairs:
        print(f"[WARN] {source_table_name} -> {target_table_name}: no compatible columns, skipped.")
        return TableMigrationStats(
            source_name=source_table_name,
            target_name=target_table_name,
            source_count=0,
            inserted_count=0,
        )

    source_count = source_conn.scalar(select(func.count()).select_from(source_table)) or 0
    if source_count == 0:
        print(f"[COPY] {source_table_name} -> {target_table_name}: 0 rows")
        return TableMigrationStats(
            source_name=source_table_name,
            target_name=target_table_name,
            source_count=0,
            inserted_count=0,
        )

    query = select(*(source_table.c[source_col_name] for source_col_name, _ in column_pairs))
    result = source_conn.execute(query)

    inserted = 0
    batch: list[dict] = []

    for row in result.mappings():
        item = {}
        for source_col_name, target_col_name in column_pairs:
            target_col = target_table.c[target_col_name]
            item[target_col_name] = _normalize_cell(row.get(source_col_name), target_col.type)
        batch.append(item)

        if len(batch) >= batch_size:
            target_conn.execute(target_table.insert(), batch)
            inserted += len(batch)
            batch.clear()

    if batch:
        target_conn.execute(target_table.insert(), batch)
        inserted += len(batch)

    print(f"[COPY] {source_table_name} -> {target_table_name}: {inserted}/{source_count} rows")
    return TableMigrationStats(
        source_name=source_table_name,
        target_name=target_table_name,
        source_count=int(source_count),
        inserted_count=inserted,
    )


def main():
    args = _parse_args()
    _ensure_valid_urls(args.source_url, args.target_url)

    source_engine = create_engine(args.source_url)
    target_engine = create_engine(args.target_url)

    if source_engine.dialect.name != "sqlite":
        raise ValueError(f"source-url must be sqlite, got: {source_engine.dialect.name}")
    if target_engine.dialect.name != "postgresql":
        raise ValueError(f"target-url must be postgresql, got: {target_engine.dialect.name}")

    source_meta = _reflect(source_engine)
    target_meta = _reflect(target_engine)

    skip_tables = {name.strip() for name in args.skip_table if name and name.strip()}
    table_pairs = _table_order(source_meta, target_meta, skip_tables)
    if not table_pairs:
        target_tables = sorted(target_meta.tables.keys())
        print(f"[DEBUG] Target tables currently: {target_tables}")
        print("[HINT] Run `alembic upgrade head` against PostgreSQL first, then rerun this migration script.")
        raise RuntimeError("No common tables found between source and target.")

    print(f"[INFO] Source: {args.source_url}")
    print(f"[INFO] Target: {args.target_url}")
    print(f"[INFO] Table pairs: {table_pairs}")
    print(f"[INFO] Batch size: {args.batch_size}")

    stats: list[TableMigrationStats] = []
    with source_engine.connect() as source_conn:
        with target_engine.begin() as target_conn:
            if args.truncate_target:
                _truncate_target_tables(target_conn, target_meta, table_pairs)
            for source_name, target_name in table_pairs:
                stats.append(
                    _copy_single_table(
                        source_conn=source_conn,
                        target_conn=target_conn,
                        source_meta=source_meta,
                        target_meta=target_meta,
                        source_table_name=source_name,
                        target_table_name=target_name,
                        batch_size=max(1, int(args.batch_size)),
                    )
                )

    total_source = sum(item.source_count for item in stats)
    total_inserted = sum(item.inserted_count for item in stats)
    print("\n[SUMMARY]")
    for item in stats:
        print(f"  - {item.source_name} -> {item.target_name}: {item.inserted_count}/{item.source_count}")
    print(f"[TOTAL] inserted={total_inserted}, source_rows={total_source}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)
