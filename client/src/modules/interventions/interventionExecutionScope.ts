/** Writes to one Baitly intervention share its optimistic-lock version. */
export const interventionExecutionScope = (id: string | undefined) => ({
  id: `intervention-execution:${id}`,
});
