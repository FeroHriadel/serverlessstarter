const AWS = require('aws-sdk');



const dynamodb = new AWS.DynamoDB.DocumentClient();
const perPage = 3; //please change this to at least 10 in normal app





/*************************************************************************************************************************************************  
    Some of these requests try to make DynamoDB work like MongoDB.
    While not entirely impossible you'll see the code is crazy (especially because of pagination) and there's too many db calls for each request.
    Also if the gap between search items was 1000 items the query would take forever to return.
    Probably a better approach is to return many items and only render some of them on the fronted.
    getByNameQuery & orderByDateQuery are done 'intelligently' like the line above says, the other queries brute-force Dynamo to behave like Mongo. 
    I will not change the brute-force code as I think it also shows a lot of tricks for future reference
*************************************************************************************************************************************************/





//ORDER BY DATE, POPULATE CATEGORY AND TAGS QUERY
const orderByDateQuery = async (dateDirection, lastEvaluatedKey) => {
    const result = await dynamodb.query({
        TableName: process.env.ITEMS_TABLE_NAME,
        IndexName: 'dateSort',
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeNames: {'#type': 'type'},
        ExpressionAttributeValues: {":type": '#ITEM'},
        ScanIndexForward: dateDirection === 'latest' ? false : true,
        ExclusiveStartKey: lastEvaluatedKey
    }).promise();

    if (!result || !result.Items) throw new Error('Failed to fetch items');

   //populate category forEach item
   if (result.Items.length) {
        let categories;
        const categoriesResult = await dynamodb.scan({TableName: process.env.CATEGORIES_TABLE_NAME}).promise();
        categories = categoriesResult.Items;
        if (!categories) throw new Error('Failed to populate categories');

        result.Items.forEach(item => {
            let categoryIndex = categories.findIndex(cat => cat.id === item.category)
            if (categoryIndex !== -1) {
                item.category = {name: categories[categoryIndex].name, id: categories[categoryIndex].id}
            }
        });
   }

   //populate tags forEach item
   if (result.Items.length) {
        if (result.Items.some(item => item.tags)) {
            let allTags;
            const response = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
            if (!response || !response.Items) throw new Error('Failed to populate tags');  
            allTags = response.Items;

            result.Items.forEach(item => {
                if (item.tags) {
                    let populatedTagsArray = []
                    item.tags.forEach(itemTag => {
                        let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                        populatedTagsArray.push(allTags[itemTagIdx]);
                    })
                    item.tags = populatedTagsArray;
                }
            })
        }
   }

   //return result
   return result
}



//GET BY NAME, ORDER BY NAME, POPULATE CATEGORY AND TAGS QUERY 
const getByNameQuery = async (name, lastEvaluatedKey) => {

    const result = await dynamodb.query({
        //query table, filter by name
        TableName: process.env.ITEMS_TABLE_NAME,
        IndexName: 'wildcard',
        KeyConditionExpression: '#type = :type',
        FilterExpression: `contains(#nameSearch, :name)`,
        ExpressionAttributeNames: {'#type': 'type', '#nameSearch': 'nameSearch'},
        ExpressionAttributeValues: {':type': '#ITEM', ':name': name.toLowerCase()},
        ScanIndexForward: true,
        ExclusiveStartKey: lastEvaluatedKey
    }).promise();

    if (!result.Items) throw new Error('No items found');

    //populate category forEach item
    if (result.Items.length) {
        let categories;
        const categoriesResult = await dynamodb.scan({TableName: process.env.CATEGORIES_TABLE_NAME}).promise();
        categories = categoriesResult.Items;
        if (!categories) throw new Error('Failed to populate categories');

        result.Items.forEach(item => {
            let categoryIndex = categories.findIndex(cat => cat.id === item.category)
            if (categoryIndex !== -1) {
                item.category = {name: categories[categoryIndex].name, id: categories[categoryIndex].id}
            }
        });
    }

    //populate tags forEach item
    if (result.Items.length) {
        if (result.Items.some(item => item.tags)) {
            let allTags;
            const response = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
            if (!response || !response.Items) throw new Error('Failed to populate tags');  
            allTags = response.Items;
    
            result.Items.forEach(item => {
                if (item.tags) {
                    let populatedTagsArray = []
                    item.tags.forEach(itemTag => {
                        let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                        populatedTagsArray.push(allTags[itemTagIdx]);
                    })
                    item.tags = populatedTagsArray;
                }
            })
        }
    }

    return result
}





//GET ALL, ORDER BY NAME, PAGINATE, POPULATE CATEGORY AND TAGS QUERY ===> MongoDB Approach (possible but unadvisable)
const orderByNameQuery = async (lastEvaluatedKey) => {
    //make request where ExclusiveStartKey = LastEvaluatedKey from previous request
    const result = await dynamodb.query({
        TableName: process.env.ITEMS_TABLE_NAME,
        IndexName: 'nameSort',
        KeyConditionExpression: '#type = :type',
        ExpressionAttributeNames: {'#type': 'type'},
        ExpressionAttributeValues: {':type': '#ITEM'},
        ScanIndexForward: true, //you can make this false to go from Z to A
        Limit: perPage, //3 for testing purposes
        ExclusiveStartKey: lastEvaluatedKey ? lastEvaluatedKey : null,
    }).promise();
    items = result.Items;

    if (!items) throw new Error('No items found');

    //populate category forEach item
    let categories;
    const categoriesResult = await dynamodb.scan({TableName: process.env.CATEGORIES_TABLE_NAME}).promise();
    categories = categoriesResult.Items;

    result.Items.forEach(item => {
        let categoryIndex = categories.findIndex(cat => cat.id === item.category)
        if (categoryIndex !== -1) {
            item.category = {name: categories[categoryIndex].name, id: categories[categoryIndex].id}
        }
    });

    //populate tags forEach item
    if (result.Items.some(item => item.tags)) {
        let allTags;
        const response = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
        if (!response || !response.Items) throw new Error('Failed to populate tags');  
        allTags = response.Items;

        result.Items.forEach(item => {
            if (item.tags) {
                let populatedTagsArray = []
                item.tags.forEach(itemTag => {
                    let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                    populatedTagsArray.push(allTags[itemTagIdx]);
                })
                item.tags = populatedTagsArray;
            }
        })
    }

    return result;
}





//GET BY CATEGORY, ORDER BY NAME, PAGINATE, POPULATE CATEGORY & TAGS QUERY ===> MongoDB Approach (possible but unadvisable)
const getByCategoryQuery = async (category, lastEvaluatedKey) => {
    //get category
    const foundCategory = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id: category}}).promise();
    if (!foundCategory || !foundCategory.Item || !foundCategory.Item.id) throw new Error('Given category not found')

    //get items by category and paginate
    limit = perPage; //3 for testing purposes
    let stopLooping = false;
    let foundItems = [];
    let result = {};

    while (!stopLooping) {
        const response = await dynamodb.query({
            TableName: process.env.ITEMS_TABLE_NAME,
            IndexName: 'categorySort',
            KeyConditionExpression: '#category = :category',
            ExpressionAttributeNames: {'#category': 'category'},
            ExpressionAttributeValues: {':category': category},
            Limit: limit,
            ExclusiveStartKey: lastEvaluatedKey
        }).promise();
        
        if (!response) throw new Error('No result returned from AWS');

        //if full limit items found immediately
        if (response.Items.length === limit) {
            foundItems = foundItems.concat(response.Items);
            result.Items = foundItems;
            result.LastEvaluatedKey = response.LastEvaluatedKey;
            stopLooping = true;
        }

        //if less than 3 items found
        else {

            //less than 3 items and all scanned
            if (!response.LastEvaluatedKey) {
                foundItems = foundItems.concat(response.Items);
                result.Items = foundItems;
                stopLooping = true;
            }

            //less than 3 items but more items left to scan
            else {
                foundItems = foundItems.concat(response.Items);
                lastEvaluatedKey = response.LastEvaluatedKey;
                limit = response.Items.length ? limit - foundItems.length : limit;
                
                if (limit === 0) {
                    stopLooping = true;
                    result.Items = foundItems;
                    result.LastEvaluatedKey = lastEvaluatedKey;
                }
            }
        }
    }

    //populate category forEach item
    result.Items.forEach(item => item.category = {id: foundCategory.Item.id, name: foundCategory.Item.name});

    //populate tags forEach item
    if (result.Items.some(item => item.tags)) {
        let allTags;
        const tagsResponse = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
        if (!tagsResponse || !tagsResponse.Items) throw new Error('Failed to populate tags');  
        allTags = tagsResponse.Items;

        result.Items.forEach(item => {
            if (item.tags) {
                let populatedTagsArray = []
                item.tags.forEach(itemTag => {
                    let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                    populatedTagsArray.push({name: allTags[itemTagIdx].name, id: allTags[itemTagIdx].id});
                })
                item.tags = populatedTagsArray;
            }
        })
    }

    //return result
    return result;
}





//GET BY TAG, ORDER BY NAME, POPULATE CATEGORY AND TAGS QUERY ===> MongoDB Approach (possible but unadvisable)
const getByTagQuery = async (tag, lastEvaluatedKey) => {
    //get all tags
    const tagsResponse = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
    if (!tagsResponse || !tagsResponse.Items) throw new Error('Fetching tags failed');

    //check if tag exists
    if (!tagsResponse.Items.some(t => t.id === tag)) throw new Error(`Tag ${tag} could not be found`);

    //get items by tag and paginate
    let limit = perPage; //3 for testing purposes
    let stopLooping = false;
    let foundItems = [];
    let result = {};

    while (!stopLooping) {
        const response = await dynamodb.query({
            TableName: process.env.ITEMS_TABLE_NAME,
            IndexName: 'nameSort',
            FilterExpression: `contains(#tags, :tag)`,
            KeyConditionExpression: '#type = :type',
            ExpressionAttributeNames: {'#type': 'type', '#tags': 'tags'},
            ExpressionAttributeValues: {':type': '#ITEM', ':tag': tag},
            ScanIndexForward: true,
            Limit: limit,
            ExclusiveStartKey: lastEvaluatedKey,
        }).promise();

        if (!response) throw new Error('No result returned from AWS');

        //if full limit found immediately
        if (response.Items.length === limit) {
            foundItems = foundItems.concat(response.Items);
            result.Items = foundItems;
            result.LastEvaluatedKey = response.LastEvaluatedKey;
            stopLooping = true;
        }

        else {

            //less than 3 items and all scanned
            if (!response.LastEvaluatedKey) {
                foundItems = foundItems.concat(response.Items);
                result.Items = foundItems;
                stopLooping = true;
            }

            //less than 3 items but more items left to scan
            else {
                foundItems = foundItems.concat(response.Items);
                lastEvaluatedKey = response.LastEvaluatedKey;
                limit = response.Items.length ? limit - foundItems.length : limit;
                
                if (limit === 0) {
                    stopLooping = true;
                    result.Items = foundItems;
                    result.LastEvaluatedKey = lastEvaluatedKey;
                }
            }
        }
    }

    //populate category forEach item
    if (result.Items.length) {
        const categoriesResponse = await dynamodb.scan({TableName: process.env.CATEGORIES_TABLE_NAME}).promise();
        if (!categoriesResponse || !categoriesResponse.Items) throw new Error('Getting items categories failed');
        let categories = categoriesResponse.Items;

        result.Items.forEach(item => {
            let idx = categories.findIndex(c => c.id === item.category);
            item.category = {name: categories[idx].name, id: categories[idx].id};
        });
    }

    //populate tags forEach item
    if (result.Items.length) {
        let allTags = tagsResponse.Items;

        result.Items.forEach(item => {
            let populatedTagsArray = [];
            item.tags.forEach(itemTag => {
                let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                populatedTagsArray.push({name: allTags[itemTagIdx].name, id: allTags[itemTagIdx].id});
            })
            item.tags = populatedTagsArray;
        })
    }

    //return result
    return result;
}




//GET BY CATEGORY AND TAG, ORDER BY NAME, POPULATE CATEGORY & TAGS QUERY ===> MongoDB Approach (possible but unadvisable)
const getByCategoryAndTagQuery = async (category, tag, lastEvaluatedKey) => {

    //check if category exists
    const foundCategory = await dynamodb.get({TableName: process.env.CATEGORIES_TABLE_NAME, Key: {id: category}}).promise();
    if (!foundCategory || !foundCategory.Item || !foundCategory.Item.id) throw new Error('Given category not found')

    //check if tag exists
    const tagsResponse = await dynamodb.scan({TableName: process.env.TAGS_TABLE_NAME}).promise();
    if (!tagsResponse || !tagsResponse.Items) throw new Error('Fetching tags failed');
    if (!tagsResponse.Items.some(t => t.id === tag)) throw new Error(`Tag ${tag} could not be found`);

    //get items by category & tag and paginate
    let limit = perPage; //3 for testing purposes
    let stopLooping = false;
    let foundItems = [];
    let result = {};

    while (!stopLooping) {
        const response = await dynamodb.query({
            TableName: process.env.ITEMS_TABLE_NAME,
            IndexName: 'nameSort',
            KeyConditionExpression: '#type = :type',
            FilterExpression: `contains(#tags, :tag) AND #category = :category`,
            ExpressionAttributeNames: {'#type': 'type', '#tags': 'tags', '#category': 'category'},
            ExpressionAttributeValues: {':type': '#ITEM', ':tag': tag, ':category': category},
            ScanIndexForward: true,
            Limit: limit,
            ExclusiveStartKey: lastEvaluatedKey ? lastEvaluatedKey : null,
        }).promise();
        items = response.Items;

        if (!items) throw new Error('No items found');

        //if full limit found immediately
        if (response.Items.length === limit) {
            foundItems = foundItems.concat(response.Items);
            result.Items = foundItems;
            result.LastEvaluatedKey = response.LastEvaluatedKey;
            stopLooping = true;
        }

        else {

            //less than 3 items and all scanned
            if (!response.LastEvaluatedKey) {
                foundItems = foundItems.concat(response.Items);
                result.Items = foundItems;
                stopLooping = true;
            }

            //less than 3 items but more items left to scan
            else {
                foundItems = foundItems.concat(response.Items);
                lastEvaluatedKey = response.LastEvaluatedKey;
                limit = response.Items.length ? limit - foundItems.length : limit;
                
                if (limit === 0) {
                    stopLooping = true;
                    result.Items = foundItems;
                    result.LastEvaluatedKey = lastEvaluatedKey;
                }
            }
        }
    }

    //populate category forEach item
    if (result.Items.length) result.Items.forEach(item => item.category = {id: foundCategory.Item.id, name: foundCategory.Item.name});

    //populate tags forEach item
    if (result.Items.length) {
        let allTags = tagsResponse.Items;

        result.Items.forEach(item => {
            let populatedTagsArray = [];
            item.tags.forEach(itemTag => {
                let itemTagIdx = allTags.findIndex(t => t.id === itemTag);
                populatedTagsArray.push({name: allTags[itemTagIdx].name, id: allTags[itemTagIdx].id});
            })
            item.tags = populatedTagsArray;
        })
    }
   
    //return result
    return result;
}




//HANDLER
exports.handler = async (event, context) => {
    try {
        //get body
        let body;
        if (event.body) body = JSON.parse(event.body);
        let LastEvaluatedKey = null;
        if (body?.LastEvaluatedKey) LastEvaluatedKey = body.LastEvaluatedKey;
        let category = null;
        if (body?.category) category = body.category;
        let tag = null;
        if (body?.tag) tag = body.tag;
        let name = null;
        if (body?.name) name = body.name;
        let dateDirection = null;
        if (body?.dateDirection) dateDirection = body.dateDirection; //'latest' for latest to oldest, 'oldest' for oldest to latest
       
        //query
        let result;
        if (name) result = await getByNameQuery(name, LastEvaluatedKey);
        else if (dateDirection) result = await orderByDateQuery(dateDirection, LastEvaluatedKey);
        else if (!category && !tag) result = await orderByNameQuery(LastEvaluatedKey);
        else if (category && !tag) result = await getByCategoryQuery(category, LastEvaluatedKey);
        else if (!category && tag) result = await getByTagQuery(tag, LastEvaluatedKey);
        else if (category && tag) result = await getByCategoryAndTagQuery(category, tag, LastEvaluatedKey);
        
        //respond
        return {
            statusCode: 200,
            headers: {'Access-Control-Allow-Origin': '*','Access-Control-Allow-Credentials': true},
            body: JSON.stringify({result}) //result will have {Items: [{item1}, {item2}, {item3}], LastEvaluatedKey: {id: 1989csc8s8scs}}
        };

    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: error?.message || error?.stack || 'Something went wrong'})
        };
    }
}
