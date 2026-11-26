import { semesterContract } from "./contracts/semester.contract";
import { createStubBackend } from "./stubs";

semesterContract(() => createStubBackend().semester);
