const AWS = require('aws-sdk');



const dynamodb = new AWS.DynamoDB.DocumentClient();
const authorizer = require('../authorizer');



exports.handler = async (event, context) => {
    try {
        //check if admin
        let decoded = await authorizer.requireAdmin(event.headers.Authorization);
        if (decoded.error) return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: decoded.error})
        }; //let user = {decoded.user}   ==> if you need access to user data

        //get email search from body
        const body = JSON.parse(event.body);
        const { emailSearch, LastEvaluatedKey } = body;
        if (!emailSearch || emailSearch.trim() === '') return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Cannot search by empty value`})
        }

        //find users
        const result = await dynamodb.query({
            TableName: process.env.USERS_TABLE_NAME,
            IndexName: 'wildcard',
            KeyConditionExpression: '#type = :type',
            FilterExpression: 'contains(#email, :emailSearch)',
            ExpressionAttributeNames: {'#type': 'type', '#email': 'email'},
            ExpressionAttributeValues: {':type': '#USER', ':emailSearch': emailSearch},
            ScanIndexForward: true,
            ExclusiveStartKey: LastEvaluatedKey
        }).promise();

        if (!result || !result.Items) return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: 'No result returned from AWS'})
        };

        result.Items.forEach(user => user.passwordHash = undefined) //remove password hash forEach user

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({result})
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