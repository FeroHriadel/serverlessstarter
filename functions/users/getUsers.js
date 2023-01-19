const AWS = require('aws-sdk');
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

        //get LastEvaluatedKey if any
        let body;
        if (event.body) body = JSON.parse(event.body);
        let LastEvaluatedKey;
        if (body?.LastEvaluatedKey) LastEvaluatedKey = body.LastEvaluatedKey;
        
        //make request where ExclusiveStartKey = LastEvaluatedKey from previous request
        const result = await dynamodb.query({
            TableName: process.env.USERS_TABLE_NAME,
            IndexName: 'emailSort',
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: {'#type': 'type'},
            ExpressionAttributeValues: {':type': '#USER'},
            ScanIndexForward: true,
            Limit: 3,
            ExclusiveStartKey: LastEvaluatedKey ? LastEvaluatedKey : null,
        }).promise();
        users = result.Items;

        if (!users) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Getting users failed'})
        };

        //remove passwordHash & type forEach user
        for (let i = 0; i < users.length; i++) {
            users[i].passwordHash = undefined;
            users[i].type = undefined;
        }

        //respond
        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({result}) //result will have {Items: [{user1}, {user2}, {user3}], LastEvaluatedKey: {id: 1989csc8s8scs}} if there's no LastEvaluatedKey, it was the last page
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
