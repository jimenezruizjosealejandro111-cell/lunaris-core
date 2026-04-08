require('dotenv').config();

console.log("🔥 LUNARIS CORE PRO ACTIVO 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 DASHBOARD
// =====================
app.get('/', (req, res) => {
    res.send(`
    <h1>🌙 Lunaris Dashboard</h1>
    <p>Bot ONLINE ✅</p>
    <a href="/panel">Abrir Panel</a>
    `);
});

// =====================
// 📊 PANEL REAL
// =====================
app.get('/panel', (req, res) => {

    db.all("SELECT * FROM economy ORDER BY balance DESC LIMIT 10", [], (err, eco) => {

        db.all("SELECT * FROM warns ORDER BY warns DESC LIMIT 10", [], (err2, warns) => {

            const ecoHTML = eco.map(u => `<tr><td>${u.userId}</td><td>${u.balance}</td></tr>`).join('');
            const warnHTML = warns.map(u => `<tr><td>${u.userId}</td><td>${u.warns}</td></tr>`).join('');

            res.send(`
            <h1>🌙 Panel Lunaris</h1>

            <h2>💰 Economía</h2>
            <table border="1">
                <tr><th>ID</th><th>Monedas</th></tr>
                ${ecoHTML}
            </table>

            <h2>⚠️ Warns</h2>
            <table border="1">
                <tr><th>ID</th><th>Warns</th></tr>
                ${warnHTML}
            </table>
            `);
        });
    });
});

app.get('/ping', (req, res) => res.send("pong"));

// =====================
// 🚀 SERVER
// =====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log("🌐 WEB ONLINE");
});

// =====================
// 💾 DB
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (
    userId TEXT PRIMARY KEY,
    balance INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS warns (
    userId TEXT PRIMARY KEY,
    warns INTEGER
)`);

// =====================
// 🤖 BOT
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const cooldowns = new Map();

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// CONFIG
// =====================
const LOG_CHANNEL = "1480726976984518839";
const WELCOME_CHANNEL = "1480384374611378176";
const AUTO_ROLE = "1480379455271600360";

// =====================
// BIENVENIDA
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcome = await member.guild.channels.fetch(WELCOME_CHANNEL);
    const logs = await member.guild.channels.fetch(LOG_CHANNEL);

    await member.roles.add(AUTO_ROLE);

    welcome.send(`🌙 Bienvenido ${member}`);
    logs.send(`📥 ${member.user.tag} entró`);
});

// =====================
// FUNCIONES
// =====================
function getUser(userId, cb) {
    db.get(`SELECT * FROM economy WHERE userId=?`, [userId], (err, row) => {
        if (!row) {
            db.run(`INSERT INTO economy VALUES (?,?)`, [userId, 0]);
            return cb({ balance: 0 });
        }
        cb(row);
    });
}

function addMoney(userId, amount) {
    db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, userId]);
}

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0];

    if (cmd === "!balance") {
        getUser(message.author.id, (data) => {
            message.reply(`💰 ${data.balance}`);
        });
    }

    if (cmd === "!work") {
        const user = message.author.id;
        const now = Date.now();
        const cd = 20 * 60 * 1000;

        if (cooldowns.has(user)) {
            const exp = cooldowns.get(user) + cd;
            if (now < exp) {
                const t = ((exp - now) / 60000).toFixed(1);
                return message.reply(`⏳ Espera ${t} min`);
            }
        }

        cooldowns.set(user, now);

        const money = Math.floor(Math.random() * 100) + 50;
        getUser(user, () => addMoney(user, money));

        message.reply(`💼 Ganaste ${money}`);
    }

    if (cmd === "!warn") {
        const user = message.mentions.users.first();
        if (!user) return;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], async (err, row) => {
            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            message.reply(`⚠️ ${warns} warns`);

            if (warns >= 10) {
                const member = await message.guild.members.fetch(user.id);
                await member.ban();
                message.channel.send(`🚫 baneado`);
            }
        });
    }

    if (cmd === "!warns") {
        const user = message.mentions.users.first() || message.author;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], (err, row) => {
            const warns = row ? row.warns : 0;
            message.reply(`⚠️ ${warns}`);
        });
    }

    if (cmd === "!clear") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        if (!amount) return;

        await message.channel.bulkDelete(amount);
        message.reply(`🧹 ${amount}`);
    }
});

client.login(process.env.TOKEN);