const AWS = require('aws-sdk');
const uuid = require('uuid');
const authorizer = require('../authorizer');



const dynamodb = new AWS.DynamoDB.DocumentClient();



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


        //check for name
        const body = JSON.parse(event.body);
        const { name, imageUrl } = body;
        if (!name) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Tag name is required`})
        }

        //if tag with same name exists return
        const checkTags = await dynamodb.query({
            TableName: process.env.TAGS_TABLE_NAME,
            IndexName: 'name',
            KeyConditionExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': name
            }
        }).promise();

        const nameExists = checkTags.Items[0] || null;
        if (nameExists) return {
                statusCode: 403,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `Tag ${name} already exists`})
        }

        //create tag
        const now = new Date();
        const tag = {
            id: uuid.v4(),
            createdAt: now.toISOString(),
            name,
            imageUrl
        };
        
        //save tag
        const savedTag = await dynamodb.put({
            TableName: process.env.TAGS_TABLE_NAME,
            Item: tag,
        }).promise();

        if (!savedTag) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Saving tag failed'})
        };

        return {
            statusCode: 201,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(tag)
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