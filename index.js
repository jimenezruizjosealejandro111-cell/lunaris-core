require('dotenv').config();

console.log("🔥 LUNARIS CORE FINAL FIX 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB
// =====================
app.get('/', (req, res) => {
    res.send(`<h1>🌙 Lunaris Online</h1><a href="/panel">Panel</a>`);
});

app.get('/panel', async (req, res) => {
    db.all("SELECT * FROM economy ORDER BY balance DESC", [], async (err, rows) => {

        let html = "";
        let pos = 1;

        for (const u of rows) {
            let medal = pos === 1 ? "🥇" :
                        pos === 2 ? "🥈" :
                        pos === 3 ? "🥉" : `#${pos}`;

            try {
                const user = await client.users.fetch(u.userId);
                html += `<div>${medal} ${user.username} - ${u.balance}</div>`;
            } catch {}

            pos++;
        }

        res.send(`<h1>Leaderboard</h1>${html}`);
    });
});

app.listen(process.env.PORT || 3000, '0.0.0.0');

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
// COMANDOS (ÚNICO BLOQUE)
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    console.log("CMD:", cmd, args);

    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL).catch(() => null);

    // =====================
    // TEST
    // =====================
    if (cmd === "!test") {
        return message.reply("✅ Bot funcionando");
    }

    // =====================
    // BALANCE
    // =====================
    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`💰 ${row?.balance || 0}`);
        });
    }

    // =====================
    // WORK
    // =====================
    if (cmd === "!work") {
        const user = message.author.id;
        const now = Date.now();
        const cd = 60 * 1000;

        if (cooldowns.has(user) && now < cooldowns.get(user)) {
            return message.reply("⏳ espera");
        }

        cooldowns.set(user, now + cd);

        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, user]);

        message.reply(`💼 +${money}`);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("💰 Ganancia")
                .addFields(
                    { name: "Usuario", value: message.author.tag },
                    { name: "Cantidad", value: `${money}` }
                );

            logChannel.send({ embeds: [embed] });
        }
    }

    // =====================
    // GIVE
    // =====================
    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user) return message.reply("❌ menciona a alguien");
        if (!amount) return message.reply("❌ cantidad inválida");

        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {

            if ((row?.balance || 0) < amount) {
                return message.reply("❌ no tienes dinero");
            }

            db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
            db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

            message.reply(`💸 ${amount} enviado`);

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor("#e74c3c")
                    .setTitle("💸 Transferencia")
                    .addFields(
                        { name: "De", value: message.author.tag },
                        { name: "Para", value: user.tag },
                        { name: "Cantidad", value: `${amount}` }
                    );

                logChannel.send({ embeds: [embed] });
            }
        });
    }

    // =====================
    // WARN
    // =====================
    if (cmd === "!warn") {
        const user = message.mentions.users.first();
        if (!user) return;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], async (err, row) => {
            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            message.reply(`⚠️ ${warns}`);

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor("#f1c40f")
                    .setTitle("⚠️ Warn")
                    .addFields(
                        { name: "Usuario", value: user.tag },
                        { name: "Total", value: `${warns}` }
                    );

                logChannel.send({ embeds: [embed] });
            }
        });
    }

    // =====================
    // CLEAR
    // =====================
    if (cmd === "!clear") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        if (!amount) return;

        await message.channel.bulkDelete(amount);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("🧹 Clear")
                .addFields(
                    { name: "Moderador", value: message.author.tag },
                    { name: "Cantidad", value: `${amount}` }
                );

            logChannel.send({ embeds: [embed] });
        }
    }

    // =====================
    // 💥 SETUP LUNARIS
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ Necesitas admin");
        }

        await message.reply("🚀 Creando servidor Lunaris...");

        const guild = message.guild;

        for (const channel of guild.channels.cache.values()) {
            try { await channel.delete(); } catch {}
        }

        const owner = await guild.roles.create({
            name: "🌙 Owner",
            color: "#9b59b6",
            permissions: ["Administrator"]
        });

        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const chat = await guild.channels.create({ name: "💬 CHAT", type: 4 });

        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "💭・general", type: 0, parent: chat.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: chat.id });

        await message.member.roles.add(owner);

        return message.channel.send("🔥 Setup completado");
    }

});

client.login(process.env.TOKEN);