const AWS = require('aws-sdk');
const authorizer = require('../authorizer');


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

        //get product
        const { id } = event.pathParameters;
        const result = await dynamodb.get({TableName: process.env.TAGS_TABLE_NAME, Key: {id}}).promise();
        const tag = result?.Item;
        if (!tag) return {
            statusCode: 404,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: `Tag with id ${id} not found`})
        }

        //delete tag
        await dynamodb.delete({TableName: process.env.TAGS_TABLE_NAME, Key: {id}}).promise();

        //delete img from bucket
        if (tag.imageUrl && tag.imageUrl.length) {
            await s3.deleteObject({
                Bucket: process.env.IMAGES_BUCKET_NAME, 
                Key: tag.imageUrl.split('.com/')[1]}).promise()
        }

        //respond
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({message: `Deleted`, ok: true})}
        
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
