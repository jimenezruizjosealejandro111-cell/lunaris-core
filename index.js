require('dotenv').config();

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const {
Client,
GatewayIntentBits,
Events,
ChannelType,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require('discord.js');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data.db');

// ================= DB =================
db.run(`CREATE TABLE IF NOT EXISTS economy (userId TEXT PRIMARY KEY, balance INTEGER)`);

// ================= WEB =================
const app = express();
let sessions = {};

app.get('/', (req,res)=>{
res.send(`<h1>Lunaris</h1><a href="/login">Login</a>`);
});

app.get('/login',(req,res)=>{
const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
res.redirect(url);
});

app.get('/callback', async (req,res)=>{
try{

const code = req.query.code;

const data = new URLSearchParams({
client_id: process.env.CLIENT_ID,
client_secret: process.env.CLIENT_SECRET,
grant_type:'authorization_code',
code,
redirect_uri: process.env.REDIRECT_URI
});

const token = await fetch('https://discord.com/api/oauth2/token',{
method:'POST',
body:data,
headers:{'Content-Type':'application/x-www-form-urlencoded'}
});

const tokenData = await token.json();

if(!tokenData.access_token) return res.send("Error OAuth");

const userRes = await fetch('https://discord.com/api/users/@me',{
headers:{authorization:`Bearer ${tokenData.access_token}`}
});

const user = await userRes.json();

sessions[user.id] = user;

res.redirect(`/panel?user=${user.id}`);

}catch(e){
res.send("OAuth error");
}
});

app.get('/panel',(req,res)=>{
const user = sessions[req.query.user];
if(!user) return res.redirect('/login');

res.send(`<h1>Panel Lunaris</h1><p>${user.username}</p>`);
});

app.listen(process.env.PORT || 3000,"0.0.0.0");

// ================= BOT =================
const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.MessageContent
]
});

client.once(Events.ClientReady, ()=>{
console.log(`ONLINE ${client.user.tag}`);
});

// ================= ECONOMIA =================
const cooldown = new Map();

client.on(Events.MessageCreate, async msg=>{
if(msg.author.bot) return;

db.run(`INSERT OR IGNORE INTO economy VALUES (?,?)`,[msg.author.id,0]);

if(msg.content === "!work"){
if(cooldown.has(msg.author.id) && Date.now() < cooldown.get(msg.author.id))
return msg.reply("⏳ Espera 30 min");

cooldown.set(msg.author.id, Date.now()+1800000);

const money = Math.floor(Math.random()*100)+50;

db.run(`UPDATE economy SET balance = balance + ? WHERE userId=?`,
[money,msg.author.id]);

msg.reply(`💼 Ganaste ${money}`);
}

if(msg.content === "!balance"){
db.get(`SELECT balance FROM economy WHERE userId=?`,
[msg.author.id],
(err,row)=>{
msg.reply(`💰 ${row.balance}`);
});
}

if(msg.content === "!daily"){
db.run(`UPDATE economy SET balance = balance + 500 WHERE userId=?`,
[msg.author.id]);
msg.reply("🎁 +500 diario");
}

if(msg.content === "!shop"){
msg.reply("🛒 VRChat+ = 20000 coins");
}

if(msg.content === "!buy"){
db.get(`SELECT balance FROM economy WHERE userId=?`,
[msg.author.id],
(err,row)=>{
if(row.balance < 20000) return msg.reply("❌ No tienes suficiente");

db.run(`UPDATE economy SET balance = balance - 20000 WHERE userId=?`,
[msg.author.id]);

msg.reply("✅ Compraste VRChat+");
});
}
});

// ================= BIENVENIDA + AUTOROL =================
client.on(Events.GuildMemberAdd, async member=>{

const role = member.guild.roles.cache.find(r=>r.name==="👤 Miembro");
if(role) member.roles.add(role);

const channel = member.guild.channels.cache.find(c=>c.name==="bienvenida");

if(channel){
channel.send(`🌙 Bienvenido ${member.user}`);
}
});

// ================= LOGS =================
client.on(Events.MessageDelete, async msg=>{
const log = msg.guild.channels.cache.find(c=>c.name==="staff-logs");
if(log) log.send(`🗑️ ${msg.author?.tag}: ${msg.content}`);
});

client.on(Events.MessageUpdate, async (oldMsg,newMsg)=>{
const log = oldMsg.guild.channels.cache.find(c=>c.name==="staff-logs");
if(log) log.send(`✏️ ${oldMsg.content} → ${newMsg.content}`);
});

// ================= TICKETS =================
async function panelTickets(channel){

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("ticket")
.setLabel("🎟 Crear Ticket")
.setStyle(ButtonStyle.Primary)
);

await channel.send({content:"🎟 Soporte",components:[row]});
}

client.on(Events.InteractionCreate, async i=>{
if(!i.isButton()) return;

if(i.customId === "ticket"){
const ch = await i.guild.channels.create({
name:`ticket-${i.user.username}`,
type:ChannelType.GuildText,
parent: i.guild.channels.cache.find(c=>c.name==="TICKETS")?.id,
permissionOverwrites:[
{id:i.guild.roles.everyone,deny:["ViewChannel"]},
{id:i.user.id,allow:["ViewChannel"]}
]
});

ch.send(`🎟 Ticket de ${i.user}`);
i.reply({content:"Ticket creado",ephemeral:true});
}
});

// ================= SETUP =================
client.on(Events.MessageCreate, async msg=>{

if(msg.content !== "!setup lunaris") return;

const g = msg.guild;

// BORRAR TODO
for(const ch of g.channels.cache.values()) try{await ch.delete()}catch{}
for(const r of g.roles.cache.values()){
if(r.name==="@everyone"||r.managed) continue;
try{await r.delete()}catch{}
}

// ROLES
await g.roles.create({name:"👤 Miembro"});
await g.roles.create({name:"💎 Admin"});

// CATEGORIAS
const info = await g.channels.create({name:"INFO",type:4});
const general = await g.channels.create({name:"GENERAL",type:4});
const media = await g.channels.create({name:"MEDIA",type:4});
const games = await g.channels.create({name:"JUEGOS",type:4});
const ticketsCat = await g.channels.create({name:"TICKETS",type:4});
const staff = await g.channels.create({name:"STAFF",type:4});

// CANALES
await g.channels.create({name:"bienvenida",parent:info.id,type:0});
await g.channels.create({name:"anuncios",parent:info.id,type:0});

await g.channels.create({name:"general",parent:general.id,type:0});
await g.channels.create({name:"economia",parent:general.id,type:0});
await g.channels.create({name:"memes",parent:general.id,type:0});
await g.channels.create({name:"eventos",parent:general.id,type:0});

await g.channels.create({name:"fotos",parent:media.id,type:0});
await g.channels.create({name:"clips",parent:media.id,type:0});

await g.channels.create({name:"valorant",parent:games.id,type:0});
await g.channels.create({name:"minecraft",parent:games.id,type:0});
await g.channels.create({name:"vrchat",parent:games.id,type:0});

const ticketChannel = await g.channels.create({name:"crear-ticket",parent:ticketsCat.id,type:0});

await panelTickets(ticketChannel);

// STAFF PRIVADO
const staffLogs = await g.channels.create({
name:"staff-logs",
parent:staff.id,
permissionOverwrites:[
{id:g.roles.everyone,deny:["ViewChannel"]},
{id:msg.author.id,allow:["ViewChannel"]}
]
});

msg.reply("🔥 SETUP EMPRESA COMPLETO");
});

client.login(process.env.TOKEN);
fix roles + autorol + tickets
