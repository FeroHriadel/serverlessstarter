const AWS = require('aws-sdk');


const dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event, context) => {
    try {
        let categories;
        const result = await dynamodb.scan({TableName: process.env.CATEGORIES_TABLE_NAME}).promise();
        categories = result.Items;

        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(categories)
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
