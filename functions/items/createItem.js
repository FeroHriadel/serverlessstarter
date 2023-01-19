const AWS = require('aws-sdk');
const uuid = require('uuid');
const authorizer = require('../authorizer');



const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();



exports.handler = async (event, context) => {
    try {
        //check if registered user
        let decoded = await authorizer.requireLogin(event.headers.Authorization);
        if (decoded.error) return {
            statusCode: 401,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: decoded.error})
        };
        const user = decoded.user;
        user.passwordHash = undefined;

        //check body
        const body = JSON.parse(event.body);
        const { name, description, category, tags, mainImage, images } = body;

        if (!name || !category) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Item name and category is required`})
        }

        //if item with same name exists delete its uploaded images & return
        const checkItems = await dynamodb.query({
            TableName: process.env.ITEMS_TABLE_NAME,
            IndexName: 'name',
            KeyConditionExpression: '#name = :name',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': name
            }
        }).promise();

        const nameExists = checkItems.Items[0] || null;
        if (nameExists) {
            if (mainImage && mainImage.length) {
                await s3.deleteObject({
                    Bucket: process.env.IMAGES_BUCKET_NAME, 
                    Key: mainImage.split('.com/')[1]
                }).promise()
            }

            if (images && images.length) {
                for (let i = 0; i < images.length; i++) {
                    await s3.deleteObject({
                        Bucket: process.env.IMAGES_BUCKET_NAME,
                        Key: images[i].split('.com/')[1]
                    }).promise()
                }
            }

            return {
                statusCode: 403,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `Item ${name} already exists`})
            }
        }

        //if category doesn't exist return
        const categoryExists = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id: category}}).promise();
        if (!categoryExists || !categoryExists?.Item || !categoryExists?.Item?.id) return {
            statusCode: 400,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: `Provided category not found`})
        }

        //check if tags exists
        if (tags) {
            if (!Array.isArray(tags)) return {
                statusCode: 400,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: `tags must be an array of tag ids`})
            }

            for (let i = 0; i < tags.length; i++) {
                const tagExists = await dynamodb.get({TableName: process.env.TAGS_TABLE_NAME, Key: {id: tags[i]}}).promise();
                if (!tagExists || !tagExists?.Item || !tagExists?.Item?.id) return {
                    statusCode: 404,
                    headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                    body: JSON.stringify({error: `Provided tag ${tags[i]} not found`})
                }
            }
        }

        //create item
        const now = new Date();
        const item = {
            id: uuid.v4(),
            createdAt: now.toISOString(),
            name,
            description,
            nameSearch: name.toLowerCase(), //this will enable case insensitve search by name
            type: '#ITEM',
            category,
            tags,
            mainImage,
            images,
            user
        };
        
        //save item
        const savedItem = await dynamodb.put({
            TableName: process.env.ITEMS_TABLE_NAME,
            Item: item,
        }).promise();

        if (!savedItem) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Saving item failed'})
        };

        //respond with created item
        return {
            statusCode: 201,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify(item)
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