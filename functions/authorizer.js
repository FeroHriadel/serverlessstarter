const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require("../env");


const dynamodb = new AWS.DynamoDB.DocumentClient();


async function requireLogin(token) {
    let decoded = {};
    try {
        const verifiedToken = jwt.verify(token, JWT_SECRET); //will throw error if bad token
        const { id } = verifiedToken //verifiedToken = {id, isAdmin}
        let user;
        const result = await dynamodb.get({TableName: process.env.USERS_TABLE_NAME, Key: {id}}).promise();
        user = result.Item;

        if (!user) {
            decoded.error = 'Unauthorized (user not found)';
            return decoded;
        }
        
        user.passwordHash = undefined;
        user.type = undefined;
        decoded.user = user;
        return decoded
    } catch (error) {
        console.log(error);
        decoded.error = 'Unauthorized (Bad token)';
        return decoded;
    }
}


async function requireAdmin(token) {
    let decoded = {};
    try {
        const verifiedToken = jwt.verify(token, JWT_SECRET);
        const { id } = verifiedToken //verifiedToken = {id, isAdmin}
        let user;
        const result = await dynamodb.get({TableName: process.env.USERS_TABLE_NAME, Key: {id}}).promise();
        user = result.Item;

        if (!user) {
            decoded.error = 'Unauthorized (user not found)';
            return decoded;
        }

        if (user.isAdmin !== 'true') {
            decoded.error = 'Admin only access';
            return decoded;
        }
        
        user.passwordHash = undefined;
        user.type = undefined;
        decoded.user = user;
        return decoded
    } catch (error) {
        console.log(error);
        decoded.error = 'Unauthorized (Bad token)';
        return decoded;
    }
}

module.exports = { requireLogin, requireAdmin }
