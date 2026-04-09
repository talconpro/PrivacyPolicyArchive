from datetime import date, datetime
from decimal import Decimal


def _serialize_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize_value(v) for v in value]
    return value


def model_to_dict(model):
    if model is None:
        return None
    data = {k: v for k, v in model.__dict__.items() if not k.startswith('_')}
    return _serialize_value(data)
