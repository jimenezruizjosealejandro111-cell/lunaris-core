require('dotenv').config();

console.log("🔥 LUNARIS LEGENDARY+ 🔥");

const express = require('express');
const { Client, GatewayIntentBits, Events, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./data.db');

app.use(express.urlencoded({ extended: true }));

// =====================
// DB
// =====================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);
db.run(`CREATE TABLE IF NOT EXISTS levels (userId TEXT PRIMARY KEY, xp INTEGER, level INTEGER)`);

db.run(`
CREATE TABLE IF NOT EXISTS config (
    guildId TEXT PRIMARY KEY,
    welcome_channel TEXT,
    log_channel TEXT,
    auto_role TEXT
)
`);

// =====================
// WEB PANEL
// =====================
app.get('/', (req,res)=>res.send("🌙 Lunaris Legendary+"));

app.get('/panel/:guildId', (req,res)=>{
    const id = req.params.guildId;

    db.get("SELECT * FROM config WHERE guildId=?", [id], (err,row)=>{
        res.send(`
        <h1>Lunaris Panel</h1>
        <form method="POST" action="/save/${id}">
        Welcome: <input name="welcome" value="${row?.welcome_channel||""}"><br>
        Logs: <input name="logs" value="${row?.log_channel||""}"><br>
        Role: <input name="role" value="${row?.auto_role||""}"><br>
        <button>Guardar</button>
        </form>
        `);
    });
});

app.post('/save/:guildId', (req,res)=>{
    const {welcome,logs,role} = req.body;
    db.run(`INSERT OR REPLACE INTO config VALUES (?,?,?,?)`,
        [req.params.guildId, welcome, logs, role]);
    res.send("Guardado");
});

app.listen(process.env.PORT||3000,"0.0.0.0");

// =====================
// BOT
// =====================
const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

function getLogs(guild){
    return new Promise(resolve=>{
        db.get("SELECT * FROM config WHERE guildId=?", [guild.id], (e,row)=>{
            resolve(row ? guild.channels.cache.get(row.log_channel) : null);
        });
    });
}

client.once(Events.ClientReady, ()=>{
    console.log(`🤖 ${client.user.tag} ONLINE`);
});

// =====================
// BIENVENIDA
// =====================
client.on(Events.GuildMemberAdd, async member=>{
    db.get("SELECT * FROM config WHERE guildId=?", [member.guild.id], async (e,row)=>{
        if(!row) return;

        const ch = member.guild.channels.cache.get(row.welcome_channel);
        const role = member.guild.roles.cache.get(row.auto_role);

        if(role) await member.roles.add(role).catch(()=>{});

        ch?.send(`🌙 Bienvenido ${member}`);
        (await getLogs(member.guild))?.send(`📥 ${member.user.tag} entró`);
    });
});

client.on(Events.GuildMemberRemove, async m=>{
    (await getLogs(m.guild))?.send(`📤 ${m.user.tag} salió`);
});

// =====================
// LOGS
// =====================
client.on(Events.MessageDelete, async m=>{
    if(!m.guild || m.author?.bot) return;

    const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🗑️ Mensaje eliminado")
        .setDescription(m.content || "Vacío");

    (await getLogs(m.guild))?.send({embeds:[embed]});
});

// =====================
// ECONOMÍA + XP
// =====================
const workCD = new Map();
const dailyCD = new Map();

client.on(Events.MessageCreate, async msg=>{
    if(msg.author.bot) return;

    db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`,[msg.author.id,0]);
    db.run(`INSERT OR IGNORE INTO levels VALUES (?,?,?)`,[msg.author.id,0,1]);

    const args = msg.content.split(" ");
    const cmd = args[0];

    if(cmd==="!balance"){
        db.get(`SELECT * FROM economy WHERE userId=?`,[msg.author.id],(e,row)=>{
            msg.reply(`💰 ${row?.balance||0}`);
        });
    }

    if(cmd==="!work"){
        if(workCD.has(msg.author.id) && Date.now()<workCD.get(msg.author.id))
            return msg.reply("⏳ 30min cooldown");

        workCD.set(msg.author.id, Date.now()+1800000);

        const money = Math.floor(Math.random()*100)+50;
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,
            [money,msg.author.id]);

        msg.reply(`💼 +${money}`);
    }

    if(cmd==="!daily"){
        if(dailyCD.has(msg.author.id) && Date.now()<dailyCD.get(msg.author.id))
            return msg.reply("⏳ daily usado");

        dailyCD.set(msg.author.id, Date.now()+86400000);

        const money = Math.floor(Math.random()*200)+100;
        db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,
            [money,msg.author.id]);

        msg.reply(`🎁 ${money}`);
    }

    if(cmd==="!shop"){
        msg.reply("1️⃣ VRChat Plus - 20000\n!buy 1");
    }

    if(cmd==="!buy"){
        db.get(`SELECT * FROM economy WHERE userId=?`,[msg.author.id],(e,row)=>{
            if((row?.balance||0)<20000) return msg.reply("❌ sin dinero");

            db.run(`UPDATE economy SET balance = balance - 20000 WHERE userId=?`,
                [msg.author.id]);

            msg.reply("🎮 Compraste VRChat Plus");
        });
    }

    // =====================
    // 🎟️ TICKETS
    // =====================
    if(cmd==="!ticket"){
        const ch = await msg.guild.channels.create({
            name:`ticket-${msg.author.username}`,
            type:ChannelType.GuildText,
            permissionOverwrites:[
                {id:msg.guild.roles.everyone, deny:["ViewChannel"]},
                {id:msg.author.id, allow:["ViewChannel"]},
            ]
        });

        ch.send(`🎟️ Ticket creado ${msg.author}`);
    }

    if(cmd==="!close"){
        if(!msg.channel.name.includes("ticket")) return;

        const closed = msg.guild.channels.cache.find(c=>c.name.includes("tickets-cerrados"));

        if(closed){
            msg.channel.setParent(closed.id);
        }

        msg.channel.send("🔒 Ticket cerrado");
    }

    // =====================
    // SETUP
    // =====================
    if(cmd==="!setup" && args[1]==="lunaris"){

        const g = msg.guild;

        for(const ch of g.channels.cache.values()) try{await ch.delete();}catch{}
        for(const r of g.roles.cache.values()){
            if(r.name==="@everyone"||r.managed) continue;
            try{await r.delete();}catch{}
        }

        const admin = await g.roles.create({name:"💎 Admin"});
        const mod = await g.roles.create({name:"🔥 Mod"});
        const member = await g.roles.create({name:"👤 Miembro"});

        const info = await g.channels.create({name:"📌 INFO",type:4});
        const staff = await g.channels.create({name:"🛠 STAFF",type:4});

        const welcome = await g.channels.create({name:"bienvenida",type:0,parent:info.id});
        const logs = await g.channels.create({name:"staff-logs",type:0,parent:staff.id});

        await g.channels.create({name:"tickets",type:0,parent:staff.id});
        await g.channels.create({name:"tickets-cerrados",type:0,parent:staff.id});

        db.run(`INSERT OR REPLACE INTO config VALUES (?,?,?,?)`,
            [g.id, welcome.id, logs.id, member.id]);

        msg.reply("🔥 Setup completo");
    }

});

client.login(process.env.TOKEN);