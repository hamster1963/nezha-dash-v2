export type gpuChartData = {
	timeStamp: string;
	gpu: number;
};

export type cpuChartData = {
	timeStamp: string;
	cpu: number;
};

export type processChartData = {
	timeStamp: string;
	process: number;
};

export type diskChartData = {
	timeStamp: string;
	disk: number;
};

export type memChartData = {
	timeStamp: string;
	mem: number;
	swap: number;
};

export type networkChartData = {
	timeStamp: string;
	upload: number;
	download: number;
};

export type connectChartData = {
	timeStamp: string;
	tcp: number;
	udp: number;
};
