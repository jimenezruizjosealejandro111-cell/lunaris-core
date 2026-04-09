require('dotenv').config();

console.log("🔥 LUNARIS CORE FINAL PRO 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder, AuditLogEvent } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB DASHBOARD
// =====================
app.get('/', (req, res) => {
    res.send(`<h1>🌙 Lunaris Dashboard</h1><a href="/panel">Ver Ranking</a>`);
});

app.get('/panel', async (req, res) => {
    db.all("SELECT * FROM levels ORDER BY level DESC", [], async (err, rows) => {

        let html = `<h1>🏆 Ranking XP</h1>`;
        let pos = 1;

        for (const u of rows) {
            try {
                const user = await client.users.fetch(u.userId);
                html += `<p>#${pos} ${user.username} - Nivel ${u.level}</p>`;
            } catch {}
            pos++;
        }

        res.send(html);
    });
});

app.listen(process.env.PORT || 3000, '0.0.0.0');

// =====================
// DB
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS warns (userId TEXT PRIMARY KEY, warns INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

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

// =====================
// 🔍 STAFF LOGS
// =====================
function getStaffLogs(guild) {
    return guild.channels.cache.find(c => c.name.includes("staff-logs"));
}

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// AUTO REGISTRO + XP
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id, 0]);
    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`, [message.author.id, 0, 1]);

    const xpGain = Math.floor(Math.random() * 10) + 5;

    db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {

        let xp = (row?.xp || 0) + xpGain;
        let level = row?.level || 1;

        if (xp >= level * 100) {
            xp = 0;
            level++;

            const reward = level * 50;
            db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [reward, message.author.id]);

            message.channel.send(`🎉 ${message.author} subió a nivel ${level}`);
        }

        db.run(`INSERT OR REPLACE INTO levels VALUES (?,?,?)`, [message.author.id, xp, level]);
    });
});

// =====================
// COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.split(" ");
    const cmd = args[0].toLowerCase();

    const logs = getStaffLogs(message.guild);

    if (cmd === "!test") return message.reply("✅ Activo");

    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`💰 ${row?.balance || 0}`);
        });
    }

    if (cmd === "!level") {
        db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`Nivel ${row?.level || 1}`);
        });
    }

    if (cmd === "!work") {
        const money = Math.floor(Math.random() * 100) + 50;
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, message.author.id]);

        message.reply(`💼 ${money}`);

        logs?.send(`💰 ${message.author.tag} ganó ${money}`);
    }

    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user || !amount) return;

        db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

        message.reply("💸 enviado");
    }

    // =====================
    // SETUP ULTRA
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        await message.reply("🚀 Creando servidor...");

        const guild = message.guild;

        for (const ch of guild.channels.cache.values()) {
            try { await ch.delete(); } catch {}
        }

        const owner = await guild.roles.create({ name: "🌙 Owner", permissions: ["Administrator"] });
        const admin = await guild.roles.create({ name: "💎 Admin" });
        const mod = await guild.roles.create({ name: "🔥 Mod" });

        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const media = await guild.channels.create({ name: "📸 MEDIA", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "📊・staff-logs", type: 0, parent: staff.id });

        await message.member.roles.add(owner);

        message.channel.send("🔥 listo");
    }
});

// =====================
// AUDITORÍA REAL
// =====================

// DELETE
client.on(Events.MessageDelete, async (message) => {
    const logs = getStaffLogs(message.guild);
    if (!logs) return;

    const fetched = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
    const entry = fetched.entries.first();

    logs.send(`🗑️ ${message.author?.tag} eliminado por ${entry?.executor?.tag}`);
});

// EDIT
client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
    const logs = getStaffLogs(newMsg.guild);
    if (!logs) return;

    logs.send(`✏️ ${newMsg.author.tag} editó mensaje`);
});

// BAN
client.on(Events.GuildBanAdd, (ban) => {
    const logs = getStaffLogs(ban.guild);
    logs?.send(`🔨 ${ban.user.tag} baneado`);
});

// KICK
client.on(Events.GuildMemberRemove, (member) => {
    const logs = getStaffLogs(member.guild);
    logs?.send(`👢 ${member.user.tag} salió/kick`);
});

client.login(process.env.TOKEN);