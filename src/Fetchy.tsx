import isEqual from "lodash/isEqual";
import pick from "lodash/pick";
import * as PropTypes from "prop-types";
import * as React from "react";
import * as request from "superagent";

export interface IState {
  fulfilled: boolean;
  pending: boolean;
  rejected: boolean;

  error?: Error;
  progress?: request.ProgressEvent;
  result?: request.Response;
  value?: any;
}

type methodType = "get" | "post" | "put" | "delete";

export interface IOptions {
  body?: string | object;
  method?: methodType;
  url?: string;
  query?: string | object;
  headers?: object;
  retry?: number;
  timeout?: number | { deadline?: number, response?: number };
  withCredentials?: boolean;

  then?(state: IState): Promise<any>;
}

export interface IBag {
  state: IState;
  fetch(options: IOptions): Promise<IState>;
  reset(): void;
}

interface IProps extends IOptions {
  children?(bag: IBag): React.ReactNode;
  render?(bag: IBag): React.ReactNode;
}

const initialState: IState = {
  fulfilled: false,
  pending: false,
  rejected: false,

  error: undefined,
  progress: undefined,
  result: undefined,
  value: undefined,
};

const compareProps = [
  "url",
  "query",
  "headers",
  "method",
];

export default class Fetchy extends React.Component<IProps, IState> {
  public static defaultProps = {};

  public static propType = {
    title: PropTypes.string,
  };

  public readonly state: IState = initialState;

  private req: any;

  public async componentDidMount() {
    if (this.props.url) {
      this.fetch();
    }
  }

  public componentDidUpdate(prevProps: IProps) {
    if (!isEqual(pick(this.props, compareProps), pick(prevProps, compareProps))) {
      this.fetch();
    }
  }

  public componentWillUnmount() {
    if (this.req) {
      this.req.abort();
    }
  }

  public render() {
    const render = typeof this.props.children === "function"
      ? this.props.children
      : this.props.render;

    if (!render) {
      throw new Error("Missing children or render props");
    }

    const bag: IBag = {
      fetch: this.fetch,
      reset: this.reset,
      state: Object.freeze({ ...this.state }),
    };

    return render(bag);
  }

  private fetch = async (options: IOptions = {}) => {
    if (this.req) {
      this.req.abort();
    }

    const mergedOptions = {
      ...this.props,
      ...options,
    };

    const {
      url,
      method = "get",
      query,
      body,
      headers,
      then,
      timeout,
      retry,
      withCredentials,
    } = mergedOptions;

    if (!url) {
      throw new Error("Parameter `url` is required.");
    }

    this.setState({ pending: true, fulfilled: false });

    let response: any;

    // Create request
    const m = method.toLowerCase() as methodType;
    const createReq = request[m];
    if (!createReq) {
      throw new Error(`Invalid method ${method}.`);
    }
    const req = createReq(url);
    this.req = req;

    if (headers) {
      req.set(headers);
    }
    if (query) {
      req.query(query);
    }
    if (body) {
      req.send(body);
    }
    if (timeout) {
      req.timeout(timeout);
    }
    if (retry) {
      req.retry(retry);
    }
    if (withCredentials) {
      req.withCredentials();
    }
    req.on("progress", (progress) => {
      this.setState({ progress });
    });
    req.on("response", (incomingMessage) => {
      response = incomingMessage;
    });

    try {
      // Wait response
      await req;

      /* istanbul ignore if : should never happend */
      if (!response) {
        throw new Error("No response");
      }

      // Handle Result
      const value = response.body;
      const state: IState = {
        ...initialState,
        fulfilled: true,
        result: response,
        value,
      };
      if (then) {
        Object.assign(state, then(state));
      }
      this.setState(state);
    } catch (error) {
      error.data = error.data || {};
      error.data.result = {
        response,
      };

      this.setState({
        error,
        fulfilled: false,
        pending: false,
        rejected: true,
        result: response,
        value: null,
      });

      throw error;
    }

    return Object.freeze({ ...this.state });
  }

  private reset = () => {
    this.setState({ ...initialState });
  }
}
