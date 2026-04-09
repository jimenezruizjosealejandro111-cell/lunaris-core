require('dotenv').config();

console.log("🔥 LUNARIS CORE GOD + XP 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB PANEL
// =====================
app.get('/', (req, res) => {
    res.send(`<h1>🌙 Lunaris Online</h1><a href="/panel">Panel</a>`);
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
// 🗄️ DATABASE
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS warns (userId TEXT PRIMARY KEY, warns INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

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

// =====================
// 🔍 AUTO LOGS
// =====================
function getLogsChannel(guild) {
    return guild.channels.cache.find(c => c.name.includes("logs"));
}

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// 🧠 AUTO REGISTRO
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id, 0]);
    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`, [message.author.id, 0, 1]);
});

// =====================
// ⚡ XP SYSTEM
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;

    const xpGain = Math.floor(Math.random() * 10) + 5;

    db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {

        let xp = (row?.xp || 0) + xpGain;
        let level = row?.level || 1;

        const needed = level * 100;

        if (xp >= needed) {
            xp = 0;
            level++;

            const reward = level * 50;

            db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [reward, message.author.id]);

            message.channel.send(`🎉 ${message.author} subió a nivel ${level} y ganó ${reward} monedas!`);
        }

        db.run(`INSERT OR REPLACE INTO levels VALUES (?,?,?)`, [message.author.id, xp, level]);
    });
});

// =====================
// ⚙️ COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    const logChannel = getLogsChannel(message.guild);

    // TEST
    if (cmd === "!test") return message.reply("✅ Bot activo");

    // BALANCE
    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`💰 ${row?.balance || 0}`);
        });
    }

    // LEVEL
    if (cmd === "!level") {
        db.get(`SELECT * FROM levels WHERE userId=?`, [message.author.id], (err, row) => {
            message.reply(`📊 Nivel ${row?.level || 1} | XP ${row?.xp || 0}`);
        });
    }

    // WORK
    if (cmd === "!work") {
        const user = message.author.id;
        const now = Date.now();
        const cd = 60000;

        if (cooldowns.has(user) && now < cooldowns.get(user)) {
            return message.reply("⏳ Espera cooldown");
        }

        cooldowns.set(user, now + cd);

        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, user]);

        message.reply(`💼 +${money}`);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("💰 Work")
                .addFields(
                    { name: "Usuario", value: message.author.tag },
                    { name: "Ganancia", value: `${money}` }
                );

            logChannel.send({ embeds: [embed] });
        }
    }

    // GIVE
    if (cmd === "!give") {
        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user) return message.reply("❌ menciona usuario");
        if (!amount) return message.reply("❌ cantidad inválida");

        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {

            if ((row?.balance || 0) < amount) {
                return message.reply("❌ no tienes suficiente");
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

    // WARN
    if (cmd === "!warn") {
        const user = message.mentions.users.first();
        if (!user) return;

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], (err, row) => {

            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            message.reply(`⚠️ ${user.tag} tiene ${warns}`);

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

    // CLEAR
    if (cmd === "!clear") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const amount = parseInt(args[1]);
        if (!amount) return;

        await message.channel.bulkDelete(amount);

        if (logChannel) {
            const embed = new EmbedBuilder()
                .setColor("#8e44ad")
                .setTitle("🧹 Clear")
                .addFields(
                    { name: "Moderador", value: message.author.tag },
                    { name: "Cantidad", value: `${amount}` }
                );

            logChannel.send({ embeds: [embed] });
        }
    }

    // =====================
    // 💥 SETUP ULTRA
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ Necesitas admin");
        }

        await message.reply("🚀 Creando Lunaris ULTRA...");

        const guild = message.guild;

        for (const channel of guild.channels.cache.values()) {
            try { await channel.delete(); } catch {}
        }

        const owner = await guild.roles.create({ name: "🌙 Owner", color: "#9b59b6", permissions: ["Administrator"] });
        const admin = await guild.roles.create({ name: "💎 Admin", color: "#3498db" });
        const mod = await guild.roles.create({ name: "🔥 Mod", color: "#e74c3c" });
        const vip = await guild.roles.create({ name: "✨ VIP", color: "#f1c40f" });
        const member = await guild.roles.create({ name: "👤 Miembro", color: "#95a5a6" });

        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const general = await guild.channels.create({ name: "💬 GENERAL", type: 4 });
        const media = await guild.channels.create({ name: "📸 MEDIA", type: 4 });
        const games = await guild.channels.create({ name: "🎮 JUEGOS", type: 4 });
        const voice = await guild.channels.create({ name: "🔊 VOZ", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "📢・anuncios", type: 0, parent: info.id });
        await guild.channels.create({ name: "👋・bienvenida", type: 0, parent: info.id });

        await guild.channels.create({ name: "💭・general", type: 0, parent: general.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: general.id });
        await guild.channels.create({ name: "😂・memes", type: 0, parent: general.id });
        await guild.channels.create({ name: "📊・logs", type: 0, parent: general.id });

        await guild.channels.create({ name: "📷・fotos", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎥・clips", type: 0, parent: media.id });
        await guild.channels.create({ name: "🎨・arte", type: 0, parent: media.id });

        await guild.channels.create({ name: "🔫・valorant", type: 0, parent: games.id });
        await guild.channels.create({ name: "💎・minecraft", type: 0, parent: games.id });
        await guild.channels.create({ name: "🌌・vrchat", type: 0, parent: games.id });

        await guild.channels.create({ name: "🔊・General", type: 2, parent: voice.id });
        await guild.channels.create({ name: "🎮・Gaming", type: 2, parent: voice.id });

        await guild.channels.create({
            name: "🧾・staff-chat",
            type: 0,
            parent: staff.id,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ["ViewChannel"] },
                { id: admin.id, allow: ["ViewChannel"] },
                { id: mod.id, allow: ["ViewChannel"] }
            ]
        });

        await guild.channels.create({
            name: "📊・staff-logs",
            type: 0,
            parent: staff.id,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: ["ViewChannel"] },
                { id: admin.id, allow: ["ViewChannel"] }
            ]
        });

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris ULTRA listo");
    }

});

client.login(process.env.TOKEN);