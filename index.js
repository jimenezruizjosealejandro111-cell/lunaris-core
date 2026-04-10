require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

const db = new Map();
const cooldowns = new Map();

// ================== READY ==================
client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} listo`);

  const commands = [
    new SlashCommandBuilder().setName("work").setDescription("Trabajar"),
    new SlashCommandBuilder().setName("balance").setDescription("Ver tu dinero"),
    new SlashCommandBuilder().setName("daily").setDescription("Recompensa diaria"),
    new SlashCommandBuilder().setName("shop").setDescription("Tienda"),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Comprar")
      .addStringOption(o =>
        o.setName("item")
          .setDescription("Nombre del item")
          .setRequired(true))
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
});

// ================== SETUP ==================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const user = interaction.user.id;
  if (!db.has(user)) db.set(user, 0);

  // WORK
  if (interaction.commandName === "work") {
    const now = Date.now();
    const last = cooldowns.get(user) || 0;

    if (now - last < 1800000) {
      return interaction.reply({ content: "⏳ Espera 30 minutos", ephemeral: true });
    }

    const earn = Math.floor(Math.random() * 200) + 50;
    db.set(user, db.get(user) + earn);
    cooldowns.set(user, now);

    return interaction.reply(`💼 Ganaste ${earn} coins`);
  }

  // BALANCE
  if (interaction.commandName === "balance") {
    return interaction.reply(`💰 Tienes ${db.get(user)} coins`);
  }

  // DAILY
  if (interaction.commandName === "daily") {
    db.set(user, db.get(user) + 500);
    return interaction.reply("🎁 Recibiste 500 coins");
  }

  // SHOP
  if (interaction.commandName === "shop") {
    return interaction.reply("🛒 VRChat+ — 20000 coins");
  }

  // BUY
  if (interaction.commandName === "buy") {
    const item = interaction.options.getString("item");

    if (item === "vrchat+") {
      if (db.get(user) < 20000)
        return interaction.reply("❌ No tienes suficientes coins");

      db.set(user, db.get(user) - 20000);
      return interaction.reply("✅ Compraste VRChat+");
    }
  }
});

// ================== AUTO SETUP SERVER ==================
client.on("messageCreate", async msg => {
  if (msg.content === "!setup") {
    const g = msg.guild;

    // ROLES
    const owner = await g.roles.create({ name: "👑 Owner" });
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
    await g.channels.create({ name: "📢・bienvenida", parent: info.id });
    await g.channels.create({ name: "📣・anuncios", parent: info.id });

    await g.channels.create({ name: "💬・general", parent: general.id });
    await g.channels.create({ name: "💰・economia", parent: general.id });
    await g.channels.create({ name: "😂・memes", parent: general.id });
    await g.channels.create({ name: "🎉・eventos", parent: general.id });

    await g.channels.create({ name: "📸・fotos", parent: media.id });
    await g.channels.create({ name: "🎬・clips", parent: media.id });

    await g.channels.create({ name: "🔫・valorant", parent: games.id });
    await g.channels.create({ name: "⛏️・minecraft", parent: games.id });
    await g.channels.create({ name: "🌌・vrchat", parent: games.id });

    // STAFF PRIVADO
    const staffLogs = await g.channels.create({
      name: "📜・staff-logs",
      parent: staff.id,
      permissionOverwrites: [
        { id: g.roles.everyone, deny: ["ViewChannel"] },
        { id: msg.member.id, allow: ["ViewChannel"] }
      ]
    });

    const ticketsCat = await g.channels.create({
      name: "🎟️ TICKETS",
      type: ChannelType.GuildCategory
    });

    const ticketPanel = await g.channels.create({
      name: "🎫・crear-ticket",
      parent: ticketsCat.id
    });

    const staffChat = await g.channels.create({
      name: "💬・staff-chat",
      parent: staff.id,
      permissionOverwrites: [
        { id: g.roles.everyone, deny: ["ViewChannel"] },
        { id: msg.member.id, allow: ["ViewChannel"] }
      ]
    });

    const closed = await g.channels.create({
      name: "📁・tickets-cerrados",
      parent: staff.id,
      permissionOverwrites: [
        { id: g.roles.everyone, deny: ["ViewChannel"] },
        { id: msg.member.id, allow: ["ViewChannel"] }
      ]
    });

    // PANEL TICKETS
    const embed = new EmbedBuilder()
      .setTitle("🎟️ Sistema de Tickets")
      .setDescription("Presiona el botón para crear un ticket");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crear_ticket")
        .setLabel("Crear Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await ticketPanel.send({ embeds: [embed], components: [row] });

    msg.reply("🔥 Setup completo");
  }
});

// ================== TICKETS ==================
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === "crear_ticket") {
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
        .setCustomId("cerrar_ticket")
        .setLabel("Cerrar")
        .setStyle(ButtonStyle.Danger)
    );

    channel.send({ content: "🎫 Ticket creado", components: [row] });

    interaction.reply({ content: "✅ Ticket creado", ephemeral: true });
  }

  if (interaction.customId === "cerrar_ticket") {
    await interaction.channel.delete();
  }
});

// ================== AUTO ROL ==================
client.on("guildMemberAdd", async member => {
  const role = member.guild.roles.cache.find(r => r.name.includes("Miembro"));
  if (role) member.roles.add(role);
});

// ================== LOGIN ==================
client.login(process.env.TOKEN);
