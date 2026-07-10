require("dotenv").config();

module.exports = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
};