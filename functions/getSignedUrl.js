const AWS = require('aws-sdk');
const authorizer = require('./authorizer');


const s3 = new AWS.S3();


exports.handler = async (event, context) => {
    try {
        //check if admin
        let decoded = await authorizer.requireAdmin(event.headers.Authorization);
        if (decoded.error) return {
            statusCode: 401,
            headers: {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': true},
            body: JSON.stringify({error: decoded.error})
        };

        //get fileName from body and preSignedUrl from AWS
        const body = JSON.parse(event.body);
        const { fileName } = body;
        if (!fileName) return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: `fileName is required`})
        }

        const randomString = (Math.random() * 100000).toFixed(0).toString();
        const Key = `${fileName}${randomString}.png`;
        const Bucket = process.env.IMAGES_BUCKET_NAME;
        const Expires = 300; //5 minutes

        const url = await s3.getSignedUrlPromise('putObject', {
            Bucket,
            Key,
            Expires,
            ContentType: 'image/png',
            ACL: 'public-read'
        });

        if (!url || typeof url !== 'string' || !url.includes('https://')) return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({error: 'Generating signed link failed'})
        }

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify({url})
        }

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
