require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, PermissionsBitField, Events, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// =====================
// EXPRESS
// =====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send("🚀 Lunaris Core activo");
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web activa`);
});

// =====================
// DATABASE
// =====================
const db = new sqlite3.Database('./data.db');

db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    item TEXT,
    price INTEGER,
    date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS warns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    userTag TEXT,
    reason TEXT,
    date TEXT
)`);

// =====================
// COOLDOWNS
// =====================
const cooldowns = {
    work: new Map(),
    daily: new Map()
};

// =====================
// FUNCTIONS
// =====================
function getUser(userId, callback) {
    db.get(`SELECT * FROM economy WHERE userId = ?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO economy (userId, balance) VALUES (?, ?)`, [userId, 0]);
            return callback({ userId, balance: 0 });
        }
        callback(row);
    });
}

function updateBalance(userId, amount) {
    db.run(`UPDATE economy SET balance = balance + ? WHERE userId = ?`, [amount, userId]);
}

// =====================
// CLIENT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} online`);
});

// =====================
// COMMANDS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args[0];

    const logChannel = await message.client.channels.fetch("1480726976984518839");

    // =====================
    // BALANCE
    // =====================
    if (command === '!balance') {
        getUser(message.author.id, (data) => {
            message.reply(`💰 Tienes: ${data.balance} monedas`);
        });
    }

    // =====================
    // WORK (20 MIN)
    // =====================
    if (command === '!work') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 20 * 60 * 1000; // 🔥 20 minutos

        if (cooldowns.work.has(userId)) {
            const expiration = cooldowns.work.get(userId) + cooldown;

            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
                return message.reply(`⏳ Espera ${timeLeft} minutos`);
            }
        }

        cooldowns.work.set(userId, now);

        const amount = Math.floor(Math.random() * 100) + 50;

        getUser(userId, () => {
            updateBalance(userId, amount);
        });

        message.reply(`💼 Ganaste ${amount} monedas`);
    }

    // =====================
    // DAILY
    // =====================
    if (command === '!daily') {
        const userId = message.author.id;
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000;

        if (cooldowns.daily.has(userId)) {
            const expiration = cooldowns.daily.get(userId) + cooldown;

            if (now < expiration) {
                const timeLeft = ((expiration - now) / 1000 / 60).toFixed(1);
                return message.reply(`⏳ Vuelve en ${timeLeft} min`);
            }
        }

        cooldowns.daily.set(userId, now);

        const amount = 200;

        getUser(userId, () => {
            updateBalance(userId, amount);
        });

        message.reply(`🎁 Daily: ${amount}`);
    }

    // =====================
    // GIVE
    // =====================
    if (command === '!give') {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user || !amount) return message.reply("Uso: !give @user cantidad");

        getUser(message.author.id, (data) => {
            if (data.balance < amount) {
                return message.reply("❌ No tienes suficiente dinero");
            }

            updateBalance(message.author.id, -amount);
            updateBalance(user.id, amount);

            message.reply(`💸 Transferiste ${amount} a ${user.tag}`);
        });
    }

    // =====================
    // SHOP
    // =====================
    if (command === '!shop') {
        message.reply("🛒 VRChat Plus cuesta 5000 monedas");
    }

    if (command === '!buy') {
        const price = 5000;

        getUser(message.author.id, (data) => {
            if (data.balance < price) {
                return message.reply("❌ No tienes suficientes monedas");
            }

            updateBalance(message.author.id, -price);

            message.reply("🛒 Compraste VRChat Plus");
        });
    }

    // =====================
    // WARN
    // =====================
    if (command === '!warn') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply("❌ Sin permisos");
        }

        const member = message.mentions.members.first();
        const user = member?.user;
        const reason = args.slice(2).join(' ') || "Sin razón";

        if (!member) return message.reply("⚠️ Menciona a alguien");

        db.run(
            `INSERT INTO warns (userId, userTag, reason, date) VALUES (?, ?, ?, ?)`,
            [user.id, user.tag, reason, new Date().toLocaleString()]
        );

        db.all(`SELECT * FROM warns WHERE userId = ?`, [user.id], async (err, rows) => {
            const totalWarns = rows.length;

            message.reply(`⚠️ ${user.tag} tiene ${totalWarns} warns`);

            if (totalWarns === 3) {
                await member.timeout(10 * 60 * 1000);
                message.channel.send(`🔇 Mute automático`);
            }

            if (totalWarns >= 10) {
                await member.ban({ reason: "Exceso de warns" });
                db.run(`DELETE FROM warns WHERE userId = ?`, [user.id]);
                message.channel.send(`🔨 Ban automático`);
            }
        });
    }

    // =====================
    // WARNS
    // =====================
    if (command === '!warns') {
        const user = message.mentions.users.first();
        if (!user) return message.reply("⚠️ Menciona a alguien");

        db.all(`SELECT * FROM warns WHERE userId = ?`, [user.id], (err, rows) => {
            if (!rows.length) return message.reply("✅ Sin warns");

            let msg = `📋 Warns:\n`;
            rows.forEach(w => {
                msg += `• ${w.reason}\n`;
            });

            message.reply(msg);
        });
    }

    // =====================
    // CLEAR
    // =====================
    if (command === '!clear') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        await message.channel.bulkDelete(amount, true);

        logChannel.send(`🧹 ${amount} mensajes borrados por ${message.author.tag}`);
    }
});

// =====================
// LOGIN
// =====================
client.login(process.env.TOKEN);