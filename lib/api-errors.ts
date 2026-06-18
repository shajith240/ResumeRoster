import {
	capturePrivateError,
	type PrivateErrorContext,
} from "@/lib/monitoring/capture-errors";

export function internalErrorResponse(
	error: unknown,
	{
		context,
		publicMessage,
		status = 500,
	}: {
		context: PrivateErrorContext;
		publicMessage: string;
		status?: number;
	},
) {
	capturePrivateError(error, context);

	return Response.json({ message: publicMessage }, { status });
}
