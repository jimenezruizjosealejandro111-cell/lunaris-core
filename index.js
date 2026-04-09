require('dotenv').config();

console.log("🔥 LUNARIS CORE ULTRA 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 DASHBOARD
// =====================
app.get('/', (req, res) => {
    res.send(`<h1>🌙 Lunaris Dashboard</h1><a href="/panel">Abrir Panel</a>`);
});

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
                    <img src="${user.displayAvatarURL()}" width="40">
                    <span>${user.username}</span>
                    <span>${u.balance} 💰</span>
                </div>`;
            } catch {}

            pos++;
        }

        res.send(`
        <html>
        <head>
            <meta http-equiv="refresh" content="5">
            <style>
                body { background:#0f0f1a; color:white; font-family:Arial; padding:20px; }
                .card { display:flex; justify-content:space-between; background:#1a1a2e; margin:10px; padding:10px; border-radius:10px; }
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

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
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

        const embed = new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle("💰 Ganancia")
            .addFields(
                { name: "Usuario", value: message.author.tag },
                { name: "Cantidad", value: `${money}` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    }

    // GIVE
    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user) return message.reply("❌ menciona a alguien");
        if (!amount) return message.reply("❌ cantidad inválida");

        getUser(message.author.id, (sender) => {

            if (sender.balance < amount) {
                return message.reply("❌ no tienes dinero");
            }

            db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
            db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

            message.reply(`💸 diste ${amount} a ${user.username}`);

            const embed = new EmbedBuilder()
                .setColor("#e74c3c")
                .setTitle("💸 Transferencia")
                .addFields(
                    { name: "De", value: message.author.tag },
                    { name: "Para", value: user.tag },
                    { name: "Cantidad", value: `${amount}` }
                )
                .setTimestamp();

            logChannel.send({ embeds: [embed] });
        });
    }

    // WARN
    if (cmd === "!warn") {
        const user = message.mentions.users.first();
        if (!user) return;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], async (err, row) => {
            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            const embed = new EmbedBuilder()
                .setColor("#f1c40f")
                .setTitle("⚠️ Warn")
                .addFields(
                    { name: "Usuario", value: user.tag },
                    { name: "Total", value: `${warns}` }
                );

            message.reply(`⚠️ ${warns}`);
            logChannel.send({ embeds: [embed] });
        });
    }

    // CLEAR
    if (cmd === "!clear") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        await message.channel.bulkDelete(amount);

        const embed = new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle("🧹 Clear")
            .addFields(
                { name: "Moderador", value: message.author.tag },
                { name: "Cantidad", value: `${amount}` }
            );

        logChannel.send({ embeds: [embed] });
    }

    // =====================
    // 🚀 SETUP LUNARIS
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ Necesitas admin");
        }

        message.reply("🚀 Creando servidor Lunaris...");

        const guild = message.guild;

        for (const channel of guild.channels.cache.values()) {
            try { await channel.delete(); } catch {}
        }

        const owner = await guild.roles.create({
            name: "🌙 Owner",
            color: "#9b59b6",
            permissions: ["Administrator"]
        });

        const admin = await guild.roles.create({ name: "💎 Admin" });
        const mod = await guild.roles.create({ name: "🔥 Mod" });

        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const chat = await guild.channels.create({ name: "💬 CHAT", type: 4 });

        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "💭・general", type: 0, parent: chat.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: chat.id });

        await message.member.roles.add(owner);

        message.channel.send("🔥 Setup completo");
    }
});

client.login(process.env.TOKEN);