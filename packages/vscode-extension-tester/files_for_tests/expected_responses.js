const expectedResponses = {
  "/api/get": {
    payload: null,
    expectedResponse: {
      meta: {
        page: 1,
        sort: "asc",
        total: 2,
      },
      data: [
        {
          id: 1,
          name: "John Doe",
          email: "john@example.com",
        },
        {
          id: 2,
          name: "Jane Doe",
          email: "jane@example.com",
        },
      ],
    },
    expectedStatus: 200,
  },
  "/api/post": {
    payload: {
      name: "Test User",
      email: "test@example.com",
      password: "secret123",
    },
    expectedResponse: {
      message: "Post request successful",
      userId: 3,
    },
    expectedStatus: 201,
  },
  "/api/patch/1": {
    payload: {
      name: "Updated Name",
    },
    expectedResponse: null,
    expectedStatus: 204,
  },
  "/api/put/2": {
    payload: {
      name: "Full Replacement",
      email: "replacement@example.com",
    },

    expectedResponse: {
      message: "Put request successful",
      user: {
        id: 2,
        name: "Full Replacement",
        email: "replacement@example.com",
      },
    },
    expectedStatus: 200,
  },
  "/api/delete/1": {
    payload: null,
    expectedResponse: `{
      "message": "Delete request successful",
      "deletedId": 1
    }`,
    expectedStatus: 204,
  },
  "api/multipart": {
    payload: {
      multipart_data: {
        uri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        type: "image/png",
        name: "profile.png",
      },
      description: "User profile picture",
    },
    expectedResponse: {
      filename: "profile.png",
      mimetype: "image/png",
      size: 70,
      metadata_received: "User profile picture",
    },
    expectedStatus: 200,
  },
  "/api/form": {
    payload: "username=testuser&password=testpass123",
    expectedResponse: {
      type: "Legacy Form",
      received_user: "testuser",
      login_status: "active",
    },
    expectedStatus: 200,
  },
  "/api/binary": {
    payload: null,
    expectedResponse:
      "WknoBdUYrrAQYURik6RhFozILE5YioTGuJ9HAOvkrrHbJdXqgUK6Za4NC+m1i60Hd+obssvQG7dN2gO/IGgZmiWtbsK2uMT60/iUMgixShbEwZXXdQK+BiG9XMW1DVz85dQBaQDrC7C9qHTg/sbEbcLMzEaexP0iSxGbLswm2hw=",
    expectedStatus: 200,
  },
  "/api/compress": {
    payload: null,
    expectedResponse: "too long",
    expectedStatus: 200,
  },
  "/api/delay": {
    payload: null,
    expectedResponse: {
      message: "Response received after delay",
      delay_ms: 3000,
    },
    expectedStatus: 200,
    expectedTime: 3000,
  },
  "/api/image": {
    payload: null,
    expectedType: "image",
    expectedStatus: 200,
  },
};

export default expectedResponses;
