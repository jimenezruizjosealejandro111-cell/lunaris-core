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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= ECONOMIA =================
const db = new Map();
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

// ================= FUNCION =================
function getChannel(guild, name) {
  return guild.channels.cache.find(c => c.name === name);
}

// ================= SLASH =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const user = i.user.id;
  if (!db.has(user)) db.set(user, 0);

  // ECONOMIA
  if (i.isChatInputCommand()) {
    if (i.commandName === "work") {
      const now = Date.now();
      const last = cooldowns.get(user) || 0;

      if (now - last < 1800000)
        return i.reply({ content: "⏳ Espera 30 min", ephemeral: true });

      const money = Math.floor(Math.random() * 200) + 50;
      db.set(user, db.get(user) + money);
      cooldowns.set(user, now);

      return i.reply(`💼 Ganaste ${money}`);
    }

    if (i.commandName === "balance") {
      return i.reply(`💰 ${db.get(user)} coins`);
    }

    if (i.commandName === "daily") {
      db.set(user, db.get(user) + 100);
      return i.reply("🎁 +100 coins");
    }

    if (i.commandName === "shop") {
      return i.reply("🛒 VRChat+ = 20000 coins");
    }

    if (i.commandName === "buy") {
      if (db.get(user) < 20000)
        return i.reply("❌ No tienes dinero");

      db.set(user, db.get(user) - 20000);
      return i.reply("✅ Compraste VRChat+");
    }
  }

  // TICKET
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
  const ticketsCat = await g.channels.create({ name: "🎟️ TICKETS", type: ChannelType.GuildCategory });
  const staff = await g.channels.create({ name: "🛠 STAFF", type: ChannelType.GuildCategory });

  // FUNCION CREAR CANAL
  async function createChannel(name, parent, text) {
    const ch = await g.channels.create({ name, parent });

    if (text) {
      const embed = new EmbedBuilder()
        .setColor("#2b2d31")
        .setDescription(text);

      ch.send({ embeds: [embed], flags: 4096 });
    }
  }

  // INFO
  await createChannel("📢・bienvenida", info.id, "🌙 Bienvenido a Lunaris. Lee las reglas.");
  await createChannel("📣・anuncios", info.id, "📢 Solo anuncios oficiales.");

  // GENERAL
  await createChannel("💬・general", general.id, "💬 Chat principal del servidor.");
  await createChannel("💰・economia", general.id, "💰 Usa /work /shop.");
  await createChannel("😂・memes", general.id, "😂 Comparte memes.");
  await createChannel("🎉・eventos", general.id, "🎉 Eventos.");

  // MEDIA
  await createChannel("📸・fotos", media.id, "📸 Comparte fotos.");
  await createChannel("🎬・clips", media.id, "🎬 Clips.");
  await createChannel("🎨・arte", media.id, "🎨 Arte.");
  await createChannel("📱・selfies", media.id, "📱 Selfies.");

  // JUEGOS
  await createChannel("🎮・general-gaming", games.id, "🎮 Gaming.");
  await createChannel("🔫・valorant", games.id, "🔫 Valorant.");
  await createChannel("⛏️・minecraft", games.id, "⛏️ Minecraft.");
  await createChannel("🌌・vrchat", games.id, "🌌 VRChat.");
  await createChannel("🕹️・otros-juegos", games.id, "🕹️ Otros juegos.");

  // VOICE
  await g.channels.create({ name: "🔊 General", type: ChannelType.GuildVoice, parent: general.id });
  await g.channels.create({ name: "🎮 Gaming", type: ChannelType.GuildVoice, parent: games.id });

  // STAFF
  await g.channels.create({
    name: "📜・staff-logs",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] },
      { id: admin.id, allow: ["ViewChannel"] }
    ]
  });

  await g.channels.create({
    name: "💬・staff-chat",
    parent: staff.id,
    permissionOverwrites: [
      { id: g.roles.everyone, deny: ["ViewChannel"] },
      { id: owner.id, allow: ["ViewChannel"] }
    ]
  });

  // TICKETS
  const ticketPanel = await g.channels.create({
    name: "🎫・crear-ticket",
    parent: ticketsCat.id
  });

  const embed = new EmbedBuilder()
    .setTitle("🎟️ Tickets")
    .setDescription("Presiona para abrir ticket");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket")
      .setLabel("Crear Ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await ticketPanel.send({ embeds: [embed], components: [row] });

  msg.channel.send("🔥 SETUP COMPLETO");
});

// ================= BIENVENIDA =================
client.on("guildMemberAdd", async member => {
  const welcome = getChannel(member.guild, "📢・bienvenida");
  const logs = getChannel(member.guild, "📜・staff-logs");

  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);

  if (welcome) {
    const embed = new EmbedBuilder()
      .setColor("#7a00ff")
      .setTitle("🌙 Bienvenido a Lunaris")
      .setDescription(`✨ ${member.user} ha llegado al servidor`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    welcome.send({ embeds: [embed], flags: 4096 });
  }

  logs?.send(`📥 ${member.user.tag} entró`);
});

// ================= LOGS =================
client.on("messageDelete", async m => {
  if (!m.guild || m.author?.bot) return;
  getChannel(m.guild, "📜・staff-logs")?.send(`🗑 ${m.author.tag}: ${m.content}`);
});

client.on("messageUpdate", async (o, n) => {
  if (!o.guild || o.author?.bot) return;
  if (o.content === n.content) return;
  getChannel(o.guild, "📜・staff-logs")?.send(`✏️ ${o.author.tag}`);
});

client.on("guildBanAdd", async ban => {
  getChannel(ban.guild, "📜・staff-logs")?.send(`🔨 ${ban.user.tag} baneado`);
});

client.on("guildMemberRemove", m => {
  getChannel(m.guild, "📜・staff-logs")?.send(`📤 ${m.user.tag} salió`);
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
