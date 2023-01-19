const AWS = require('aws-sdk');



const dynamodb = new AWS.DynamoDB.DocumentClient();



exports.handler = async (event, context) => {
    try {
        const { id } = event.pathParameters;

        let tag;
        const result = await dynamodb.get({TableName: process.env.TAGS_TABLE_NAME, Key: {id}}).promise();
        tag = result.Item;

        if (!tag) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Tag not found'})
        };

        return {
            statusCode: 200,
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