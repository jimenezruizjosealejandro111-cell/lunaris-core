require('dotenv').config();

console.log("🔥 LUNARIS CORE FINAL 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 DASHBOARD
// =====================
app.get('/', (req, res) => {
    res.send(`
    <h1>🌙 Lunaris Dashboard</h1>
    <a href="/panel">Abrir Leaderboard</a>
    `);
});

// =====================
// 🏆 LEADERBOARD PRO
// =====================
app.get('/panel', async (req, res) => {

    db.all("SELECT * FROM economy ORDER BY balance DESC", [], async (err, eco) => {

        let html = "";
        let pos = 1;

        for (const u of eco) {

            let medal = pos === 1 ? "🥇" :
                        pos === 2 ? "🥈" :
                        pos === 3 ? "🥉" : `#${pos}`;

            try {
                const user = await client.users.fetch(u.userId);

                html += `
                <div class="card">
                    <span>${medal}</span>
                    <img src="${user.displayAvatarURL()}" class="avatar">
                    <span>${user.username}</span>
                    <span>${u.balance} 💰</span>
                </div>`;
            } catch {
                html += `<div class="card">${medal} ${u.userId} ${u.balance}</div>`;
            }

            pos++;
        }

        res.send(`
        <html>
        <head>
            <meta http-equiv="refresh" content="5">
            <style>
                body { background:#0f0f1a; color:white; font-family:Arial; padding:20px; }
                h1 { text-align:center; color:#9b59b6; }
                .card {
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    background:#1a1a2e;
                    padding:15px;
                    margin:10px 0;
                    border-radius:10px;
                }
                .avatar { width:40px; border-radius:50%; }
            </style>
        </head>
        <body>
            <h1>🌙 Lunaris Leaderboard</h1>
            ${html}
        </body>
        </html>
        `);
    });
});

// =====================
// SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');

// =====================
// DB
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS warns (userId TEXT PRIMARY KEY, warns INTEGER)`);

// =====================
// BOT
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

const LOG_CHANNEL = "1480726976984518839";
const WELCOME_CHANNEL = "1480384374611378176";
const AUTO_ROLE = "1480379455271600360";

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// BIENVENIDA
// =====================
client.on(Events.GuildMemberAdd, async (member) => {
    const welcome = await member.guild.channels.fetch(WELCOME_CHANNEL);
    const logs = await member.guild.channels.fetch(LOG_CHANNEL);

    await member.roles.add(AUTO_ROLE);

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [member.id, 0]);
    db.run(`INSERT OR IGNORE INTO warns VALUES (?,?)`, [member.id, 0]);

    welcome.send(`🌙 Bienvenido ${member}`);
    logs.send(`📥 ${member.user.tag} entró`);
});

// =====================
// AUTO REGISTRO
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id, 0]);
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

    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL);

    // BALANCE
    if (cmd === "!balance") {
        getUser(message.author.id, (data) => {
            message.reply(`💰 ${data.balance}`);
        });
    }

    // WORK
    if (cmd === "!work") {
        const user = message.author.id;
        const now = Date.now();
        const cd = 20 * 60 * 1000;

        if (cooldowns.has(user)) {
            const exp = cooldowns.get(user) + cd;
            if (now < exp) return message.reply("⏳ espera");
        }

        cooldowns.set(user, now);

        const money = Math.floor(Math.random() * 100) + 50;
        getUser(user, () => addMoney(user, money));

        message.reply(`💼 +${money}`);
        logChannel.send(`💰 ${message.author.tag} ganó ${money}`);
    }

    // GIVE
    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user) return message.reply("❌ menciona a alguien");
        if (!amount || amount <= 0) return message.reply("❌ cantidad inválida");

        getUser(message.author.id, (sender) => {

            if (sender.balance < amount) {
                return message.reply("❌ no tienes dinero");
            }

            db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);

            getUser(user.id, () => {
                db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);
            });

            message.reply(`💸 diste ${amount} a ${user.username}`);
            logChannel.send(`💸 ${message.author.tag} dio ${amount} a ${user.tag}`);
        });
    }

    // WARN
    if (cmd === "!warn") {
        const user = message.mentions.users.first();
        if (!user) return;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], async (err, row) => {
            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            message.reply(`⚠️ ${warns}`);
            logChannel.send(`⚠️ ${user.tag} tiene ${warns} warns`);

            if (warns >= 10) {
                const member = await message.guild.members.fetch(user.id);
                await member.ban();
                logChannel.send(`🚫 ${user.tag} fue baneado`);
            }
        });
    }

    // CLEAR
    if (cmd === "!clear") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        if (!amount) return;

        await message.channel.bulkDelete(amount);

        const embed = new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle("🧹 Mensajes eliminados")
            .addFields(
                { name: "Moderador", value: message.author.tag },
                { name: "Cantidad", value: `${amount}` },
                { name: "Canal", value: `${message.channel}` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });

        message.reply(`🧹 ${amount} eliminados`);
    }
});

client.login(process.env.TOKEN);