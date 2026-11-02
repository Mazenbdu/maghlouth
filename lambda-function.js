const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "ClubHubCourses";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Build a standard HTTP response object.
 * @param {number} statusCode
 * @param {*} body  - will be JSON-serialised
 */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * GET /  – return all courses from the table.
 */
async function listCourses() {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLE_NAME })
  );
  return buildResponse(200, { courses: result.Items ?? [] });
}

/**
 * POST /  – add a new course.
 * Expected body: { courseId, name, dueDate, type }
 */
async function addCourse(body) {
  const { courseId, name, dueDate, type } = body ?? {};

  if (!courseId || !name || !dueDate || !type) {
    return buildResponse(400, {
      error: "Missing required fields: courseId, name, dueDate, type",
    });
  }

  const item = { courseId, name, dueDate, type };

  await docClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: item })
  );

  return buildResponse(201, { message: "Course added successfully", course: item });
}

/**
 * DELETE /  – remove a course by courseId.
 * Expected body: { courseId }
 */
async function deleteCourse(body) {
  const { courseId } = body ?? {};

  if (!courseId) {
    return buildResponse(400, { error: "Missing required field: courseId" });
  }

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { courseId },
    })
  );

  return buildResponse(200, { message: "Course deleted successfully", courseId });
}

/**
 * Main Lambda handler.
 */
module.exports.handler = async (event) => {
  // Support Lambda Function URLs (API GW v2 payload) with fallback to v1
  const httpMethod =
    (event.requestContext && event.requestContext.http && event.requestContext.http.method) ||
    event.httpMethod;

  // Handle CORS pre-flight requests
  if (httpMethod === "OPTIONS") {
    return buildResponse(200, {});
  }

  // Parse the request body once, safely
  let parsedBody = null;
  if (event.body) {
    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      return buildResponse(400, { error: "Invalid JSON in request body" });
    }
  }

  try {
    switch (httpMethod) {
      case "GET":
        return await listCourses();

      case "POST":
        return await addCourse(parsedBody);

      case "DELETE":
        return await deleteCourse(parsedBody);

      default:
        return buildResponse(405, {
          error: `Method '${httpMethod}' is not supported`,
        });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    return buildResponse(500, { error: "Internal server error" });
  }
};
