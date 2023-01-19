const AWS = require('aws-sdk');
const uuid = require('uuid');
const bcrypt = require('bcryptjs');


const dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event, context) => {
    try {
        const body = JSON.parse(event.body);
        const { email, password } = body;
        const now = new Date();

        //check email and password (required fields)
        if (!email || !password) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Email and Password are required'})
        };

        //check if email exists
        let emailFound;
        const result = await dynamodb.query({
            TableName: process.env.USERS_TABLE_NAME,
            IndexName: 'email',
            KeyConditionExpression: '#email = :email',
            ExpressionAttributeNames: {'#email': 'email'},
            ExpressionAttributeValues: {':email': email.toLowerCase()}
        }).promise();
        emailFound = result.Items.length > 0;

        if (emailFound) return {
            statusCode: 401,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Email already taken'})
        };

        //save user
        let user = {
            id: uuid.v4(),
            createdAt: now.toISOString(),
            email: email.toLowerCase(),
            passwordHash: bcrypt.hashSync(password, 10),
            isAdmin: 'false', //dynamodb cannot find by boolean GSI
            type: "#USER" //this will help us with sorting
        };
        
        const savedUser = await dynamodb.put({
            TableName: process.env.USERS_TABLE_NAME,
            Item: user
        }).promise();

        if (!savedUser) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Saving user failed'})
        };

        user.passwordHash = undefined;
        user.type = undefined;

        return {
            statusCode: 201,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(user)
        };

    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: error.message || error.stack || 'Something went wrong'})
        };
    }
}
