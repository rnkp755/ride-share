import asyncHandler from "../utils/asyncHandler.js";
import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { Key } from "../models/key.model.js";
import axios from "axios";

const OUTLOOK_SUGGESTION_URL =
    "https://outlook.office.com/search/api/v1/suggestions";

const outlookAPIBodyGenerator = (email) => {
    return JSON.parse(
        `{"AppName":"OWA","Scenario":{"Name":"owa.react.compose"},"Cvid":"3fa1f07c-6cf9-2c1c-aa38-b0a89b472e68","EntityRequests":[{"Query":{"QueryString":"${email}"},"EntityType":"People","Provenances":["Directory"],"Size":1,"Fields":["DisplayName","EmailAddresses"]}]}`
    );
};

const getNameFromOutlook = async (email) => {
    try {
        const key = await Key.findById("outlook-access-token");
        if (!key) {
            throw new APIError(404, "Keys not found");
        }
        const accessToken = key.accessToken;
        const response = await axios.post(
            OUTLOOK_SUGGESTION_URL,
            outlookAPIBodyGenerator(email),
            {
                headers: {
                    Authorization: `Bearer ${accessToken}c`,
                    "Content-Type": "application/json",
                },
            }
        );

        // No suggestions found
        if (response.data.Groups?.length === 0) {
            return {
                status: 404,
                name: null,
            };
        }
        return {
            status: response.status,
            name: response.data.Groups[0].Suggestions[0].DisplayName,
        };
    } catch (error) {
        return {
            status: error.response?.status || 500,
            name: null,
        };
    }
};

const getName = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new APIError(404, "Email is required");
    }
    const { status, name } = await getNameFromOutlook(email);

    return res
        .status(status)
        .json(
            new APIResponse(
                status,
                { name },
                `${status == 200 ? "Success" : "Error"}`
            )
        );
});

export { getName, getNameFromOutlook };
