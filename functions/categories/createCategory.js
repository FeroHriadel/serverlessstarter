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
        const { name, description } = body;
        if (!name) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Category name is required`})
        }

        //if category with same name exists return
        const checkCategories = await dynamodb.query({
            TableName: process.env.CATEGORIES_TABLE_NAME,
            IndexName: 'categoryName', //here is the GSI indexName from categoriesTable
            KeyConditionExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'name' //here is the exact name of the field you are looking for ('name')
            },
            ExpressionAttributeValues: {
                ':name': name //here is the value of the field
            }
        }).promise();

        const nameExists = checkCategories.Items[0] || null;
        if (nameExists) return {
                statusCode: 403,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `Category ${name} already exists`})
        }

        //create category
        const now = new Date();
        const category = {
            id: uuid.v4(),
            createdAt: now.toISOString(),
            name,
            description
        };
        
        //save category
        const savedCategory = await dynamodb.put({
            TableName: process.env.CATEGORIES_TABLE_NAME,
            Item: category,
        }).promise();

        if (!savedCategory) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Saving product failed'})
        };

        return {
            statusCode: 201,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(category)
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