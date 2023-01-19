const AWS = require('aws-sdk');


const dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event, context) => {
    try {
        let tags;
        const result = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
        tags = result.Items;

        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(tags)
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
