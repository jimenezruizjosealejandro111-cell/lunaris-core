require('dotenv').config();

console.log("🔥 LUNARIS LEGENDARY FINAL 🔥");

const express = require('express');
const {
    Client,
    GatewayIntentBits,
    Events,
    PermissionsBitField,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

// =====================
// 🌐 WEB KEEP ALIVE
// =====================
app.get('/', (req, res) => res.send("🌙 Lunaris Online"));
app.listen(process.env.PORT || 3000, "0.0.0.0");

// =====================
// 🗄️ DATABASE
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS config (guildId TEXT PRIMARY KEY, welcome TEXT, logs TEXT, role TEXT)`);

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

client.once(Events.ClientReady, () => {
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// 🔎 UTILS
// =====================
function getConfig(guildId) {
    return new Promise(resolve => {
        db.get(`SELECT * FROM config WHERE guildId=?`, [guildId], (err, row) => {
            resolve(row);
        });
    });
}

// =====================
// 👋 BIENVENIDA + AUTOROL
// =====================
client.on(Events.GuildMemberAdd, async member => {

    const config = await getConfig(member.guild.id);
    if (!config) return;

    const channel = member.guild.channels.cache.get(config.welcome);
    const role = member.guild.roles.cache.get(config.role);

    if (role) await member.roles.add(role).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor("#9b59b6")
        .setTitle("🌙 Bienvenido a Lunaris")
        .setDescription(`✨ ${member} ha llegado\n🚀 Disfruta la comunidad`);

    channel?.send({ embeds: [embed] });

    const logs = member.guild.channels.cache.get(config.logs);
    logs?.send(`📥 ${member.user.tag} entró`);
});

client.on(Events.GuildMemberRemove, async member => {
    const config = await getConfig(member.guild.id);
    if (!config) return;

    const logs = member.guild.channels.cache.get(config.logs);
    logs?.send(`📤 ${member.user.tag} salió`);
});

// =====================
// 🧾 LOGS MENSAJES
// =====================
client.on(Events.MessageDelete, async msg => {
    if (!msg.guild || msg.author?.bot) return;

    const config = await getConfig(msg.guild.id);
    if (!config) return;

    const logs = msg.guild.channels.cache.get(config.logs);

    const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🗑️ Mensaje eliminado")
        .addFields(
            { name: "Usuario", value: msg.author.tag },
            { name: "Contenido", value: msg.content || "Vacío" }
        );

    logs?.send({ embeds: [embed] });
});

// =====================
// 💰 ECONOMÍA
// =====================
const workCD = new Map();

client.on(Events.MessageCreate, async msg => {

    if (msg.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`, [msg.author.id, 0]);

    const args = msg.content.split(" ");
    const cmd = args[0];

    if (cmd === "!balance") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [msg.author.id], (e, row) => {
            msg.reply(`💰 ${row?.balance || 0}`);
        });
    }

    if (cmd === "!work") {
        if (workCD.has(msg.author.id) && Date.now() < workCD.get(msg.author.id))
            return msg.reply("⏳ 30 minutos cooldown");

        workCD.set(msg.author.id, Date.now() + 1800000);

        const money = Math.floor(Math.random() * 100) + 50;

        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,
            [money, msg.author.id]);

        msg.reply(`💼 Ganaste ${money}`);
    }

    if (cmd === "!shop") {
        msg.reply("🎮 VRChat Plus - 20000 coins\n!buy 1");
    }

    if (cmd === "!buy") {
        db.get(`SELECT * FROM economy WHERE userId=?`, [msg.author.id], (e, row) => {

            if ((row?.balance || 0) < 20000)
                return msg.reply("❌ No tienes suficiente dinero");

            db.run(`UPDATE economy SET balance = balance - 20000 WHERE userId=?`,
                [msg.author.id]);

            msg.reply("✅ Compraste VRChat Plus");
        });
    }
});

// =====================
// 🎟️ BOTÓN TICKETS
// =====================
client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isButton()) return;

    if (interaction.customId === "ticket") {

        const existing = interaction.guild.channels.cache.find(c =>
            c.name === `ticket-${interaction.user.id}`
        );

        if (existing)
            return interaction.reply({ content: "❌ Ya tienes un ticket", ephemeral: true });

        const channel = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone, deny: ["ViewChannel"] },
                { id: interaction.user.id, allow: ["ViewChannel"] }
            ]
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("close")
                .setLabel("🔒 Cerrar")
                .setStyle(ButtonStyle.Danger)
        );

        channel.send({
            content: `🎟️ Ticket de ${interaction.user}`,
            components: [row]
        });

        interaction.reply({ content: "✅ Ticket creado", ephemeral: true });
    }

    if (interaction.customId === "close") {
        await interaction.channel.delete().catch(()=>{});
    }
});

// =====================
// ⚙️ SETUP
// =====================
client.on(Events.MessageCreate, async msg => {

    if (msg.content !== "!setup lunaris") return;

    const g = msg.guild;

    for (const ch of g.channels.cache.values()) {
        try { await ch.delete(); } catch {}
    }

    for (const r of g.roles.cache.values()) {
        if (r.name === "@everyone" || r.managed) continue;
        try { await r.delete(); } catch {}
    }

    const member = await g.roles.create({ name: "👤 Miembro" });

    const info = await g.channels.create({ name: "📌 INFO", type: 4 });
    const general = await g.channels.create({ name: "💬 GENERAL", type: 4 });
    const staff = await g.channels.create({ name: "🛠 STAFF", type: 4 });

    const welcome = await g.channels.create({ name: "bienvenida", type: 0, parent: info.id });
    const logs = await g.channels.create({ name: "staff-logs", type: 0, parent: staff.id });

    const tickets = await g.channels.create({ name: "tickets", type: 0, parent: staff.id });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket")
            .setLabel("🎟️ Crear Ticket")
            .setStyle(ButtonStyle.Primary)
    );

    tickets.send({
        content: "🎟️ Soporte Lunaris",
        components: [row]
    });

    db.run(`INSERT OR REPLACE INTO config VALUES (?,?,?,?)`,
        [g.id, welcome.id, logs.id, member.id]);

    msg.reply("🔥 Setup completo");
});

client.login(process.env.TOKEN);