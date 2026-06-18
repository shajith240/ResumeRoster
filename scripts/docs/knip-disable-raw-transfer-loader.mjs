const KNIP_AST_NODES_MODULE = "/node_modules/knip/dist/typescript/ast-nodes.js";

export async function load(url, context, nextLoad) {
	const result = await nextLoad(url, context);

	if (!url.endsWith(KNIP_AST_NODES_MODULE)) {
		return result;
	}

	return {
		...result,
		source: String(result.source).replace(
			"experimentalRawTransfer: rawTransferSupported(),",
			"experimentalRawTransfer: false,",
		),
	};
}
