const AWS = require('aws-sdk');



const dynamodb = new AWS.DynamoDB.DocumentClient();



exports.handler = async (event, context) => {
    try {
        const { id } = event.pathParameters;

        let category;
        const result = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id}}).promise();
        category = result.Item;

        if (!category) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Category not found'})
        };

        return {
            statusCode: 200,
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
            body: JSON.stringify({error: error.stack || error.message || 'Something went wrong'})
        };
    }
}