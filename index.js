require("dotenv").config();

// ================= WEB =================
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("🌙 Lunaris Core Online");
});

app.listen(process.env.PORT || 3000, "0.0.0.0");

// ================= DISCORD =================
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

// ================= DATABASE =================
const sqlite3 = require("sqlite3").verbose();
const database = new sqlite3.Database("./economy.db");

database.run(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 0
)
`);

function getCoins(id) {
  return new Promise((resolve) => {
    database.get("SELECT coins FROM users WHERE id = ?", [id], (err, row) => {
      if (!row) {
        database.run("INSERT INTO users (id, coins) VALUES (?, 0)", [id]);
        return resolve(0);
      }
      resolve(row.coins);
    });
  });
}

function addCoins(id, amount) {
  database.run(`
    INSERT INTO users (id, coins)
    VALUES (?, ?)
    ON CONFLICT(id)
    DO UPDATE SET coins = coins + ?
  `, [id, amount, amount]);
}

// ================= BOT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const cooldowns = new Map();

// ================= READY =================
client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} ONLINE`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria"),
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= SLASH =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const user = i.user.id;

  if (i.isChatInputCommand()) {

    if (i.commandName === "work") {
      const now = Date.now();
      const last = cooldowns.get(user) || 0;

      if (now - last < 1800000)
        return i.reply({ content: "⏳ Espera 30 min", ephemeral: true });

      const money = Math.floor(Math.random() * 200) + 50;
      addCoins(user, money);
      cooldowns.set(user, now);

      return i.reply(`💼 Ganaste ${money}`);
    }

    if (i.commandName === "balance") {
      const coins = await getCoins(user);
      return i.reply(`💰 ${coins} coins`);
    }

    if (i.commandName === "daily") {
      addCoins(user, 500);
      return i.reply("🎁 +500 coins");
    }
  }

  // TICKETS
  if (i.isButton() && i.customId === "ticket") {
    const ch = await i.guild.channels.create({
      name: `ticket-${i.user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: ["ViewChannel"] },
        { id: i.user.id, allow: ["ViewChannel"] }
      ]
    });

    ch.send("🎟 Ticket creado, el staff te responderá pronto.");
    i.reply({ content: "✅ Ticket creado", ephemeral: true });
  }
});

// ================= SETUP =================
client.on("messageCreate", async msg => {
  if (msg.content !== "!setup") return;

  const g = msg.guild;
  await msg.reply("⚙️ Configurando servidor...");

  // LIMPIAR
  for (const ch of g.channels.cache.values()) {
    try { await ch.delete(); } catch {}
  }

  for (const r of g.roles.cache.values()) {
    if (r.name === "@everyone") continue;
    try { await r.delete(); } catch {}
  }

  // ROLES
  const owner = await g.roles.create({ name: "👑 Owner", permissions: ["Administrator"] });
  const admin = await g.roles.create({ name: "🔥 Admin" });
  const mod = await g.roles.create({ name: "🛠 Mod" });
  const member = await g.roles.create({ name: "👤 Miembro" });

  await msg.member.roles.add(owner);

  // CATEGORIAS
  const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
  const general = await g.channels.create({ name: "💬 GENERAL", type: ChannelType.GuildCategory });
  const media = await g.channels.create({ name: "📸 MEDIA", type: ChannelType.GuildCategory });
  const games = await g.channels.create({ name: "🎮 JUEGOS", type: ChannelType.GuildCategory });
  const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

  // CANALES
  async function ch(name, parent, text) {
    const c = await g.channels.create({ name, parent });
    const embed = new EmbedBuilder().setDescription(text).setColor("#2b2d31");
    c.send({ embeds: [embed] }); // 🔊 ahora sí notifica
  }

  await ch("📢・bienvenida", info.id, "🌙 Bienvenido a Lunaris");
  await ch("💬・general", general.id, "💬 Chat principal");
  await ch("💰・economia", general.id, "💰 Usa /work /balance");
  await ch("📸・fotos", media.id, "📸 Comparte fotos");
  await ch("🎮・general-gaming", games.id, "🎮 Gaming");

  await g.channels.create({ name: "🔊 General", type: ChannelType.GuildVoice, parent: general.id });

  await g.channels.create({
    name: "📜・staff-logs",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] }
    ]
  });

  msg.channel.send("🔥 SETUP COMPLETO");
});

// ================= BIENVENIDA + LOG =================
client.on("guildMemberAdd", async member => {
  const welcome = member.guild.channels.cache.find(c => c.name.includes("bienvenida"));
  const logs = member.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  const embed = new EmbedBuilder()
    .setColor("#7a00ff")
    .setTitle("🌙 Bienvenido a Lunaris")
    .setDescription(`✨ ${member.user} ha llegado`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage("https://i.imgur.com/8Km9tLL.png")
    .setTimestamp();

  welcome?.send({ embeds: [embed] });

  const logEmbed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("📥 Usuario entró")
    .setDescription(`${member.user.tag}`)
    .setTimestamp();

  logs?.send({ embeds: [logEmbed] });
});

// ================= LOG MENSAJES =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;

  const logs = m.guild.channels.cache.find(c => c.name.includes("staff-logs"));

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🗑️ Mensaje eliminado")
    .setDescription(`${m.author.tag}: ${m.content || "Sin texto"}`)
    .setTimestamp();

  logs?.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
