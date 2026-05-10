import json


def user_to_dict(row):
    return {
        'telegram_id': row['telegram_id'],
        'username': row['username'],
        'avatar_url': row['avatar_url'],
        'balance': row['balance'],
        'stars': row['stars'],
        'level': row['level'],
        'click_power': row['click_power'],
        'passive_income': row['passive_income'],
        'progress': row['progress'],
        'total_clicks': row['total_clicks'],
        'total_earned': row['total_earned'],
        'click_upgrades': json.loads(row['click_upgrades']),
        'farm_upgrades': json.loads(row['farm_upgrades']),
        'bonus_upgrades': json.loads(row['bonus_upgrades']),
        'donors': json.loads(row['donors']),
}

def validate_telegram_id(telegram_id):
    try:
        return int(telegram_id) > 0
    except:
        return False