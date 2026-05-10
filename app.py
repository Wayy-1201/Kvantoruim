import os
import json
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, g , render_template
from flask_cors import CORS
import database as DB
import othersfuncioons as FYNC

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

DATABASE = 'crystal_clicker.db'
LEADERBOARD_LIMIT = 100


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'ok': False, 'error': 'Нет данных'}), 400
    
    telegram_id = data.get('telegram_id')
    if not FYNC.validate_telegram_id(telegram_id):
        return jsonify({'ok': False, 'error': 'Неверный telegram_id'}), 400
    
    username = data.get('username', 'Аноним')[:50]
    avatar_url = data.get('avatar_url', '')
    db = DB.get_db()
    
    existing = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
    
    if existing:
        db.execute('UPDATE users SET username = ?, avatar_url = ?, updated_at = ? WHERE telegram_id = ?', (username, avatar_url, datetime.now(), telegram_id))
        db.commit()
        user = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
        rating = db.execute('SELECT AVG(score) as avg, COUNT(*) as count FROM ratings WHERE to_user = ?', (telegram_id,)).fetchone()
        user_dict = FYNC.user_to_dict(user)
        user_dict['rating'] = {'avg': round(rating['avg'], 1) if rating['avg'] else 0, 'count': rating['count']}
        return jsonify({'ok': True, 'user': user_dict, 'is_new': False})
    
    db.execute('INSERT INTO users (telegram_id, username, avatar_url) VALUES (?, ?, ?)', (telegram_id, username, avatar_url))
    db.commit()
    user = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
    user_dict = FYNC.user_to_dict(user)
    user_dict['rating'] = {'avg': 0, 'count': 0}
    return jsonify({'ok': True, 'user': user_dict, 'is_new': True})

@app.route('/api/sync', methods=['POST'])
def sync():
    data = request.get_json()
    if not data:
        return jsonify({'ok': False, 'error': 'Нет данных'}), 400
    
    telegram_id = data.get('telegram_id')
    if not FYNC.validate_telegram_id(telegram_id):
        return jsonify({'ok': False, 'error': 'Неверный telegram_id'}), 400
    
    db = DB.get_db()
    existing = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
    if not existing:
        return jsonify({'ok': False, 'error': 'Пользователь не найден'}), 404
    
    db.execute('''
        UPDATE users SET
            balance = ?, stars = ?, level = ?, click_power = ?, passive_income = ?,
            progress = ?, total_clicks = ?, total_earned = ?,
            click_upgrades = ?, farm_upgrades = ?, bonus_upgrades = ?, donors = ?,
            updated_at = ?, last_sync = ?
        WHERE telegram_id = ?
    ''', (
        data.get('balance', existing['balance']),
        data.get('stars', existing['stars']),
        data.get('level', existing['level']),
        data.get('click_power', existing['click_power']),
        data.get('passive_income', existing['passive_income']),
        data.get('progress', existing['progress']),
        data.get('total_clicks', existing['total_clicks']),
        data.get('total_earned', existing['total_earned']),
        json.dumps(data.get('click_upgrades', json.loads(existing['click_upgrades']))),
        json.dumps(data.get('farm_upgrades', json.loads(existing['farm_upgrades']))),
        json.dumps(data.get('bonus_upgrades', json.loads(existing['bonus_upgrades']))),
        json.dumps(data.get('donors', json.loads(existing['donors']))),
        datetime.now(), datetime.now(), telegram_id
    ))
    db.commit()
    
    user = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
    return jsonify({'ok': True, 'user': FYNC.user_to_dict(user)})

@app.route('/api/user/<int:telegram_id>', methods=['GET'])
def get_user(telegram_id):
    if not FYNC.validate_telegram_id(telegram_id):
        return jsonify({'ok': False, 'error': 'Неверный telegram_id'}), 400
    db = DB.get_db()
    user = db.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,)).fetchone()
    if not user:
        return jsonify({'ok': False, 'error': 'Пользователь не найден'}), 404
    rating = db.execute('SELECT AVG(score) as avg_score, COUNT(*) as count FROM ratings WHERE to_user = ?', (telegram_id,)).fetchone()
    return jsonify({
        'ok': True,
        'user': FYNC.user_to_dict(user),
        'rating': {
            'avg': round(rating['avg_score'], 1) if rating['avg_score'] else 0,
            'count': rating['count']
        }
    })

@app.route('/api/leaderboard', methods=['GET'])
def leaderboard():
    sort_by = request.args.get('sort', 'balance')
    limit = min(int(request.args.get('limit', 50)), LEADERBOARD_LIMIT)
    offset = max(int(request.args.get('offset', 0)), 0)
    
    sort_map = {
        'balance': 'u.balance DESC',
        'total_earned': 'u.total_earned DESC',
        'level': 'u.level DESC, u.balance DESC',
        'rating': 'avg_rating DESC',
        'total_clicks': 'u.total_clicks DESC'
    }
    order = sort_map.get(sort_by, 'u.balance DESC')
    db = DB.get_db()
    
    rows = db.execute(f'''
        SELECT u.telegram_id, u.username, u.avatar_url, u.balance, u.level,
                u.total_clicks, u.total_earned,
                COALESCE(avg_r.avg_score, 0) as avg_rating,
                COALESCE(avg_r.rating_count, 0) as rating_count
        FROM users u
        LEFT JOIN (
            SELECT to_user, AVG(score) as avg_score, COUNT(*) as rating_count
            FROM ratings GROUP BY to_user
        ) avg_r ON avg_r.to_user = u.telegram_id
        ORDER BY {order}
        LIMIT ? OFFSET ?
    ''', (limit, offset)).fetchall()
    
    total = db.execute('SELECT COUNT(*) as cnt FROM users').fetchone()['cnt']
    
    result = []
    for i, row in enumerate(rows):
        result.append({
            'rank': offset + i + 1,
            'telegram_id': row['telegram_id'],
            'username': row['username'],
            'avatar_url': row['avatar_url'],
            'balance': row['balance'],
            'level': row['level'],
            'total_clicks': row['total_clicks'],
            'total_earned': row['total_earned'],
            'avg_rating': round(row['avg_rating'], 1),
            'rating_count': row['rating_count']
        })
    
    return jsonify({'ok': True, 'leaderboard': result, 'total_users': total})

@app.route('/api/rate', methods=['POST'])
def rate_user():
    data = request.get_json()
    if not data:
        return jsonify({'ok': False, 'error': 'Нет данных'}), 400
    
    from_user = data.get('from_user')
    to_user = data.get('to_user')
    score = data.get('score')
    comment = data.get('comment', '')[:200]
    
    if not FYNC.validate_telegram_id(from_user) or not FYNC.validate_telegram_id(to_user):
        return jsonify({'ok': False, 'error': 'Неверный telegram_id'}), 400
    if from_user == to_user:
        return jsonify({'ok': False, 'error': 'Нельзя оценить себя'}), 400
    if not isinstance(score, int) or score < 1 or score > 5:
        return jsonify({'ok': False, 'error': 'Оценка от 1 до 5'}), 400
    
    db = DB.get_db()
    for uid in [from_user, to_user]:
        if not db.execute('SELECT telegram_id FROM users WHERE telegram_id = ?', (uid,)).fetchone():
            return jsonify({'ok': False, 'error': f'Пользователь {uid} не найден'}), 404
    
    db.execute('''
        INSERT INTO ratings (from_user, to_user, score, comment, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(from_user, to_user)
        DO UPDATE SET score = ?, comment = ?, created_at = ?
    ''', (from_user, to_user, score, comment, datetime.now(), score, comment, datetime.now()))
    db.commit()
    
    rating = db.execute('SELECT AVG(score) as avg_score, COUNT(*) as count FROM ratings WHERE to_user = ?', (to_user,)).fetchone()
    return jsonify({
        'ok': True,
        'rating': {
            'avg': round(rating['avg_score'], 1) if rating['avg_score'] else 0,
            'count': rating['count']
        }
    })

@app.route('/api/ratings/<int:telegram_id>', methods=['GET'])
def get_ratings(telegram_id):
    if not FYNC.validate_telegram_id(telegram_id):
        return jsonify({'ok': False, 'error': 'Неверный telegram_id'}), 400
    limit = min(int(request.args.get('limit', 20)), 50)
    offset = max(int(request.args.get('offset', 0)), 0)
    db = DB.get_db()
    
    avg = db.execute('SELECT AVG(score) as avg_score, COUNT(*) as count FROM ratings WHERE to_user = ?', (telegram_id,)).fetchone()
    ratings = db.execute('''
        SELECT r.from_user, u.username as from_username, r.score, r.comment, r.created_at
        FROM ratings r
        JOIN users u ON u.telegram_id = r.from_user
        WHERE r.to_user = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    ''', (telegram_id, limit, offset)).fetchall()
    
    return jsonify({
        'ok': True,
        'avg': round(avg['avg_score'], 1) if avg['avg_score'] else 0,
        'count': avg['count'],
        'ratings': [{
            'from_user': r['from_user'],
            'from_username': r['from_username'],
            'score': r['score'],
            'comment': r['comment'],
            'created_at': r['created_at']
        } for r in ratings]
    })




if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        DB.init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)



