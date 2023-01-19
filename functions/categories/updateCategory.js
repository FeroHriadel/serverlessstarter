const AWS = require('aws-sdk');
let authorizer = require('../authorizer');



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

        const { id } = event.pathParameters;
        let { name, description } = JSON.parse(event.body);
        if (!description) description = '';

        if (!name) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Name is required'})
        };

        //check if category exists
        let category;
        const result = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id}}).promise();
        category = result.Item;

        if (!category) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Category not found'})
        };

        //if other category with same name exists return
        const checkCategories = await dynamodb.query({
            TableName: process.env.CATEGORIES_TABLE_NAME,
            IndexName: 'categoryName',
            KeyConditionExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': name
            }
        }).promise();

        const nameExists = checkCategories.Items[0] || null;
        if (nameExists && nameExists.id !== id) return {
                statusCode: 403,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `Category with name "${name}" already exists`})
        }

        const params = {
            TableName: process.env.CATEGORIES_TABLE_NAME,
            Key: {id},
            UpdateExpression: 'set #name = :name, #description = :description', //must do `#name` as `name` is a reserved word
            ExpressionAttributeNames: {'#name': 'name', '#description': 'description'}, //actual names for `#...` things
            ExpressionAttributeValues: {':name': name, ':description': description}, //new values
            ReturnValues: 'ALL_NEW'
        };

        let updatedCategory;
        const updateResult = await dynamodb.update(params).promise();
        updatedCategory = updateResult.Attributes;

        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(updatedCategory)
        };

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
