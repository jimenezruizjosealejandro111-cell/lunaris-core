require('dotenv').config();

console.log("🔥 LUNARIS CORE GOD MODE 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB PANEL
// =====================
app.get('/', (req, res) => {
    res.send(`
    <h1>🌙 Lunaris Core ONLINE</h1>
    <a href="/panel">Ir al Panel</a>
    `);
});

app.get('/panel', async (req, res) => {
    db.all("SELECT * FROM economy ORDER BY balance DESC", [], async (err, rows) => {

        let html = `<h1>🏆 Lunaris Leaderboard</h1>`;
        let pos = 1;

        for (const u of rows) {
            let medal = pos === 1 ? "🥇" :
                        pos === 2 ? "🥈" :
                        pos === 3 ? "🥉" : `#${pos}`;

            try {
                const user = await client.users.fetch(u.userId);
                html += `<p>${medal} ${user.username} - 💰 ${u.balance}</p>`;
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
const LOG_CHANNEL = "1480726976984518839"; // ⚠️ CAMBIA ESTO

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// 🧠 AUTO REGISTRO
// =====================
client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [message.author.id, 0]);
});

// =====================
// ⚙️ COMANDOS
// =====================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    console.log("CMD:", cmd);

    const logChannel = await message.guild.channels.fetch(LOG_CHANNEL).catch(() => null);

    // =====================
    // TEST
    // =====================
    if (cmd === "!test") {
        return message.reply("✅ Bot activo");
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
        const cd = 60000;

        if (cooldowns.has(user) && now < cooldowns.get(user)) {
            return message.reply("⏳ Espera cooldown");
        }

        cooldowns.set(user, now + cd);

        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [money, user]);

        message.reply(`💼 Ganaste ${money}`);

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

    // =====================
    // GIVE
    // =====================
    if (cmd === "!give") {

        const user = message.mentions.users.first();
        const amount = parseInt(args[2]);

        if (!user) return message.reply("❌ Menciona usuario");
        if (!amount) return message.reply("❌ Cantidad inválida");

        db.get(`SELECT * FROM economy WHERE userId=?`, [message.author.id], (err, row) => {

            if ((row?.balance || 0) < amount) {
                return message.reply("❌ No tienes suficiente");
            }

            db.run(`UPDATE economy SET balance = balance - ? WHERE userId=?`, [amount, message.author.id]);
            db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`, [amount, user.id]);

            message.reply(`💸 Transferido ${amount}`);

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

        db.get(`SELECT * FROM warns WHERE userId=?`, [user.id], (err, row) => {

            let warns = row ? row.warns + 1 : 1;

            db.run(`INSERT OR REPLACE INTO warns VALUES (?,?)`, [user.id, warns]);

            message.reply(`⚠️ ${user.tag} ahora tiene ${warns}`);

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
    // 💥 SETUP PRO
    // =====================
    if (cmd === "!setup" && args[1] === "lunaris") {

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❌ Necesitas admin");
        }

        await message.reply("🚀 Creando Lunaris PRO...");

        const guild = message.guild;

        // borrar canales
        for (const channel of guild.channels.cache.values()) {
            try { await channel.delete(); } catch {}
        }

        // ROLES
        const owner = await guild.roles.create({ name: "🌙 Owner", color: "#9b59b6", permissions: ["Administrator"] });
        const admin = await guild.roles.create({ name: "💎 Admin", color: "#3498db" });
        const mod = await guild.roles.create({ name: "🔥 Mod", color: "#e74c3c" });
        const member = await guild.roles.create({ name: "👤 Miembro", color: "#95a5a6" });

        // CATEGORÍAS
        const info = await guild.channels.create({ name: "📌 INFORMACIÓN", type: 4 });
        const chat = await guild.channels.create({ name: "💬 CHAT", type: 4 });
        const voice = await guild.channels.create({ name: "🔊 VOZ", type: 4 });
        const staff = await guild.channels.create({ name: "🛠️ STAFF", type: 4 });

        // CANALES
        await guild.channels.create({ name: "📜・reglas", type: 0, parent: info.id });
        await guild.channels.create({ name: "📢・anuncios", type: 0, parent: info.id });

        await guild.channels.create({ name: "💭・general", type: 0, parent: chat.id });
        await guild.channels.create({ name: "💰・economia", type: 0, parent: chat.id });
        await guild.channels.create({ name: "📊・logs", type: 0, parent: chat.id });

        await guild.channels.create({ name: "🔊・General", type: 2, parent: voice.id });

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

        await message.member.roles.add(owner);

        message.channel.send("🔥 Lunaris PRO creado");
    }

});

client.login(process.env.TOKEN);