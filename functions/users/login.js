const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../env'); //create /env.js and put there: exports.JWT_SECRET = `your_jwt_secret` for this to work. Also put env.js to /.gitignore


const dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event, context) => {
    try {
        //check for email and password
        const body = JSON.parse(event.body);
        const { email, password } = body;
        if (!email || !password) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Email and Password are required'})
        };

        //find user by email
        let user;
        const result = await dynamodb.query({
            TableName: process.env.USERS_TABLE_NAME,
            IndexName: 'email',
            KeyConditionExpression: '#email = :email',
            ExpressionAttributeNames: {'#email': 'email'},
            ExpressionAttributeValues: {':email': email}
        }).promise();
        user = result.Items && result.Items[0] ? result.Items[0] : null;

        if (!user) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'User not found'})
        };

        //check password & generate token
        if (bcrypt.compareSync(password, user.passwordHash)) {
            const token = jwt.sign({id: user.id, isAdmin: user.isAdmin}, JWT_SECRET);
            user.passwordHash = undefined;
            user.type = undefined;
            return {
                statusCode: 200,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({user, token})
            };

        } else {
            return {
                statusCode: 401,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: 'Bad email or password'})
            };
        }

        

    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: error.stack || error.message || 'Something went wrong'})
        };
    }
}
