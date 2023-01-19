const AWS = require('aws-sdk');
let authorizer = require('../authorizer');



const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();



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
        const body = JSON.parse(event.body);
        let { name, imageUrl } = body;
        if (!imageUrl) imageUrl = '';

        if (!name) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Name is required'})
        };

        //check if tag exists
        let tag;
        const result = await dynamodb.get({TableName: process.env.TAGS_TABLE_NAME, Key: {id}}).promise();
        tag = result.Item;

        if (!tag) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Tag not found'})
        };

        //if other tag with same name exists return
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
        if (nameExists && nameExists.id !== id) return {
                statusCode: 403,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `Tag with name "${name}" already exists`})
        }

        //update tag
        const params = {
            TableName: process.env.TAGS_TABLE_NAME,
            Key: {id},
            UpdateExpression: 'set #name = :name, #imageUrl = :imageUrl',
            ExpressionAttributeNames: {'#name': 'name', '#imageUrl': 'imageUrl'},
            ExpressionAttributeValues: {':name': name, ':imageUrl': imageUrl},
            ReturnValues: 'ALL_NEW'
        };

        let updatedTag;
        const updateResult = await dynamodb.update(params).promise();
        updatedTag = updateResult.Attributes;

        if (!updatedTag) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Update failed`})
        }

        //delete old image from bucket (unless user uploaded the same file)
        if (tag.imageUrl && tag.imageUrl !== '' && tag.imageUrl !== imageUrl) {
            await s3.deleteObject({
                Bucket: process.env.IMAGES_BUCKET_NAME, 
                Key: tag.imageUrl.split('.com/')[1]
            }).promise()
        }

        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(updatedTag)
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
