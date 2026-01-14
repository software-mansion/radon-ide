import { QueryClient } from "@tanstack/query-core";
import { patchQueryClient } from "__RNIDE_lib__/plugins/react-query/patchQueryClient";

patchQueryClient(QueryClient.prototype);
