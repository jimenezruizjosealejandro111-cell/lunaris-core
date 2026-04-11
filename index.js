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
    new SlashCommandBuilder().setName("shop").setDescription("Tienda"),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Comprar")
      .addStringOption(o =>
        o.setName("item").setDescription("Item").setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
});

// ================= FUNC =================
function getChannel(guild, name) {
  return guild.channels.cache.find(c => c.name === name);
}

// ================= SLASH =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const user = i.user.id;

  // ECONOMIA
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

    if (i.commandName === "shop") {
      return i.reply("🛒 VRChat+ = 20000 coins");
    }

    if (i.commandName === "buy") {
      const coins = await getCoins(user);

      if (coins < 20000)
        return i.reply("❌ No tienes dinero");

      addCoins(user, -20000);
      return i.reply("✅ Compraste VRChat+");
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
  await msg.reply("⚙️ Configurando servidor PRO...");

  for (const ch of g.channels.cache.values()) {
    try { await ch.delete(); } catch {}
  }

  for (const r of g.roles.cache.values()) {
    if (r.name === "@everyone") continue;
    try { await r.delete(); } catch {}
  }

  const owner = await g.roles.create({ name: "👑 Owner", permissions: ["Administrator"] });
  const admin = await g.roles.create({ name: "🔥 Admin" });
  const mod = await g.roles.create({ name: "🛠 Mod" });
  const member = await g.roles.create({ name: "👤 Miembro" });

  await msg.member.roles.add(owner);

  const info = await g.channels.create({ name: "📌 INFO", type: ChannelType.GuildCategory });
  const general = await g.channels.create({ name: "💬 GENERAL", type: ChannelType.GuildCategory });
  const media = await g.channels.create({ name: "📸 MEDIA", type: ChannelType.GuildCategory });
  const games = await g.channels.create({ name: "🎮 JUEGOS", type: ChannelType.GuildCategory });
  const ticketsCat = await g.channels.create({ name: "🎟️ TICKETS", type: ChannelType.GuildCategory });
  const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

  async function createChannel(name, parent, text) {
    const ch = await g.channels.create({ name, parent });

    if (text) {
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setDescription(text);

      ch.send({ embeds: [embed], flags: 4096 });
    }
  }

  await createChannel("📢・bienvenida", info.id, "🌙 Bienvenido a Lunaris.");
  await createChannel("💬・general", general.id, "💬 Chat principal.");
  await createChannel("💰・economia", general.id, "💰 Usa /work /shop.");
  await createChannel("📸・fotos", media.id, "📸 Comparte fotos.");
  await createChannel("🎮・general-gaming", games.id, "🎮 Gaming.");

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

// ================= BIENVENIDA =================
client.on("guildMemberAdd", async member => {
  const welcome = getChannel(member.guild, "📢・bienvenida");

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  if (welcome) {
    const embed = new EmbedBuilder()
      .setColor("#7a00ff")
      .setTitle("🌙 Bienvenido")
      .setDescription(`${member.user} se unió`);

    welcome.send({ embeds: [embed], flags: 4096 });
  }
});

// ================= LOGS =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;

  const logs = getChannel(m.guild, "📜・staff-logs");

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🗑️ Mensaje eliminado")
    .setDescription(`${m.author.tag}: ${m.content}`);

  logs?.send({ embeds: [embed] });
});

client.login(process.env.TOKEN);
