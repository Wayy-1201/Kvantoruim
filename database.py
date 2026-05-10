import sqlite3
from flask import g
DATABASE = "crystal_clicker.db"

def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT DEFAULT 'Аноним',
            avatar_url TEXT DEFAULT '',
            balance INTEGER DEFAULT 0,
            stars INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            click_power INTEGER DEFAULT 1,
            passive_income INTEGER DEFAULT 0,
            progress INTEGER DEFAULT 0,
            total_clicks INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            click_upgrades TEXT DEFAULT '{"power1":0,"power2":0,"power3":0}',
            farm_upgrades TEXT DEFAULT '{"worker":0,"farmer":0,"harvester":0}',
            bonus_upgrades TEXT DEFAULT '{"luck":0,"crit":0}',
            donors TEXT DEFAULT '{"x2":false,"x2sek":false,"superclick":false}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user INTEGER NOT NULL,
            to_user INTEGER NOT NULL,
            score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
            comment TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(from_user, to_user)
        )
    ''')

    db.commit()
    db.close()



def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db