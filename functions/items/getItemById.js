const AWS = require('aws-sdk');



const dynamodb = new AWS.DynamoDB.DocumentClient();



exports.handler = async (event, context) => {
    try {
        //get id from params
        const { id } = event.pathParameters;

        //check if item exists
        let item;
        const result = await dynamodb.get({TableName: process.env.ITEMS_TABLE_NAME, Key: {id}}).promise();
        item = result.Item;

        if (!item) return {
            statusCode: 404,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Item not found'})
        };

        //populate category
        let category;
        const categoryResult = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id: item.category}}).promise();
        category = categoryResult.Item;
        if (!category) return {
            statusCode: 500,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: 'Failed to populate category'})
        };
        item.category = category;

        //populate tags
        if (item.tags && item.tags.length) {
            const tagsResponse = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
            if (!tagsResponse || !tagsResponse.Items) return {
                statusCode: 500,
                headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
                body: JSON.stringify({error: 'Failed to populate tags'})
            };
            const allTags = tagsResponse.Items;

            let populatedTagsArray = [];
            item.tags.forEach(itemTag => {
                let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                populatedTagsArray.push({name: allTags[itemTagIdx].name, id: allTags[itemTagIdx].id});
            })
            item.tags = populatedTagsArray;
        }
        
        return {
            statusCode: 200,
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