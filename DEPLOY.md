# Deploying the Pathfinder frontend to AWS

The frontend is a static site (`vite build` -> `dist/`), so hosting is cheap and
simple. This guide assumes you have an **AWS IAM user** and starts with a quick
"smoke" deploy to prove the pipeline, then the proper HTTPS setup.

> Costs: S3 + CloudFront are within the AWS Free Tier for demo-level traffic.

## 0. One-time: install + configure the AWS CLI

```bash
# install (macOS: brew install awscli ; Linux: see AWS docs)
aws --version

# configure with your IAM user's access key + secret
aws configure
#   AWS Access Key ID:     <from your IAM user>
#   AWS Secret Access Key: <from your IAM user>
#   Default region name:   us-east-1
#   Default output format: json

aws sts get-caller-identity   # should print your account/user — confirms it works
```

### IAM permissions your user needs
For the hackathon, attach these AWS-managed policies to your IAM user
(Console -> IAM -> Users -> your user -> Add permissions):
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`

(These are broad for convenience; scope them down later for production.)

## 1. Smoke deploy (fastest — S3 static website, HTTP)

Proves the build + upload works. Bucket names are globally unique, so pick your own.

```bash
BUCKET=pathfinder-demo-<your-initials>
REGION=us-east-1

# create the bucket
aws s3 mb "s3://$BUCKET" --region "$REGION"

# allow public reads for this bucket (needed for S3 website hosting)
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"PublicRead\",
    \"Effect\": \"Allow\",
    \"Principal\": \"*\",
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::$BUCKET/*\"
  }]
}"

# enable static website hosting (SPA: serve index.html for 404s too)
aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html

# build + upload
BUCKET=$BUCKET npm run deploy
```

Your site URL depends on the region's endpoint format:
- newer regions (e.g. us-east-2) use a dot: `http://$BUCKET.s3-website.$REGION.amazonaws.com`
- older regions (e.g. us-east-1) use a dash: `http://$BUCKET.s3-website-$REGION.amazonaws.com`

The exact URL is shown in Console -> S3 -> your bucket -> Properties -> Static website hosting.
(Verified live: http://pathfinder-demo-mudit.s3-website.us-east-2.amazonaws.com)

## 2. Proper deploy (HTTPS via CloudFront)

For the real demo URL you want HTTPS. Easiest path in the Console:

1. Keep the bucket **private** (re-enable Block Public Access).
2. Console -> CloudFront -> Create distribution.
   - Origin: your S3 bucket (choose "Origin access control settings (recommended)", create an OAC).
   - CloudFront will give you a bucket policy snippet — apply it so only CloudFront can read the bucket.
   - Default root object: `index.html`.
   - (SPA) Under "Error pages", map 403 and 404 -> `/index.html` with response code 200. *(Optional here since the app uses a single in-page route, but harmless and future-proof.)*
3. After it deploys (~5 min), note the **Distribution domain** (`dxxxx.cloudfront.net`) and the **Distribution ID**.
4. Deploy with invalidation:

```bash
BUCKET=your-bucket DISTRIBUTION_ID=YOURDISTID npm run deploy
```

## 3. Pointing at the backend

When Teammate 2's API is hosted, build with its URL so the app calls the real
`/roadmap/next` instead of the mock:

```bash
BUCKET=your-bucket DISTRIBUTION_ID=YOURDISTID \
VITE_API_BASE_URL=https://your-backend-host \
npm run deploy
```

(`VITE_*` is baked in at build time, so a redeploy is how you change it. The
backend must allow CORS from your CloudFront/S3 origin.)

## Notes
- `scripts/deploy.sh` builds, syncs `dist/` (long-cache assets, no-cache `index.html`), and invalidates CloudFront if `DISTRIBUTION_ID` is set.
- Never commit real credentials. `.env*` is gitignored; AWS creds live in `aws configure` (`~/.aws/credentials`).
