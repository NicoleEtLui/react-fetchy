// throw error if no options.id
// check error on timeout

// TODOS:
// * Pause/resume

import * as React from "react";
import * as request from "superagent";
import {
  initialState as singleInitialState,
  IOptions,
  IState,
  methodType,
} from "./Fetchy";

export interface IMultiState {
  [id: string]: IState | undefined;
}

interface ISingleOptions extends IOptions {
  id: string;
}

export interface IMultiOptions {
  concurrency: number;
  requests: ISingleOptions[];
}

export interface IMultiBag {
  states: {
    [id: string]: IState;
  };
  abort: (id?: string) => void;
}

interface IProps extends IMultiOptions {
  children?(bag: IMultiBag): React.ReactNode;
  render?(bag: IMultiBag): React.ReactNode;
}

const initialState: IMultiState = {};

class AbortError extends Error {
  public message = "Request has been aborted";
}

export default class FetchyMulti extends React.Component<IProps, IMultiState> {
  public static defaultProps: IProps = {
    concurrency: 2,
    requests: [],
  };

  public readonly state: IMultiState = initialState;

  private requests: {
    [id: string]: request.SuperAgentRequest;
  } = {};

  public async componentDidMount() {
    this.checkQueue();
  }

  public componentDidUpdate(previousProps: IProps) {
    if (previousProps === this.props) {
      return;
    }

    // Clean state
    this.setState(
      state =>
        Object.keys(state).reduce((newState, id) => {
          const request = this.props.requests.find(
            request => request.id === id,
          );
          return {
            ...newState,
            [id]: request ? state[id] : undefined,
          };
        }, {}),
      () => {
        // Abort running
        this.requests = Object.keys(this.requests).reduce((newRequests, id) => {
          const request = this.props.requests.find(
            request => request.id === id,
          );

          if (request) {
            return {
              ...newRequests,
              [id]: this.requests[id],
            };
          } else {
            this.abort(id);
            return newRequests;
          }
        }, {});

        this.checkQueue();
      },
    );
  }

  public componentWillUnmount() {
    this.abort();
  }

  public render() {
    const render =
      typeof this.props.children === "function"
        ? this.props.children
        : this.props.render;

    if (!render) {
      throw new Error("Missing children or render props");
    }

    const bag: IMultiBag = {
      abort: this.abort,
      states: this.props.requests.reduce(
        (bagStates, request) => ({
          ...bagStates,
          [request.id]: this.state[request.id] || singleInitialState,
        }),
        {},
      ),
    };

    return render(bag);
  }

  private fetch = async (options: ISingleOptions) => {
    if (this.requests[options.id]) {
      this.requests[options.id].abort();
      delete this.requests[options.id];
    }

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
    } = options;

    if (!url) {
      throw new Error("Parameter `url` is required.");
    }

    this.setState({
      [options.id]: {
        ...singleInitialState,
        fulfilled: false,
        pending: true,
      },
    });

    let response: any;

    // Create request
    const m = method.toLowerCase() as methodType;
    const createReq = request[m];
    if (!createReq) {
      throw new Error(`Invalid method ${method}.`);
    }
    const req = createReq(url);
    this.requests[options.id] = req;

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
    req.on("progress", progress => {
      this.setState(state => ({
        [options.id]: {
          ...(state[options.id] || singleInitialState),
          progress,
        },
      }));
    });
    req.on("response", incomingMessage => {
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
        ...singleInitialState,
        fulfilled: true,
        result: response,
        value,
      };
      if (then) {
        Object.assign(state, then(state));
      }
      this.setState({
        [options.id]: state,
      });
    } catch (error) {
      console.log("errror ?");

      error.data = error.data || {};
      error.data.result = {
        response,
      };

      this.setState({
        [options.id]: {
          error,
          fulfilled: false,
          pending: false,
          rejected: true,
          result: response,
          value: null,
        },
      });

      throw error;
    }

    return Object.freeze({ ...this.state });
  };

  private async checkQueue() {
    const { concurrency } = this.props;
    const runningRequestCount = Object.keys(this.state).filter(id => {
      const state = this.state[id];
      return state ? state.pending : false;
    }).length;
    const availableCount = concurrency - runningRequestCount;
    const requestsTodo = this.props.requests.filter(request => {
      const runningRequest = this.requests[request.id];
      if (runningRequest) {
        return false;
      }
      return true;
    });

    await Promise.all(
      requestsTodo.slice(0, availableCount).map(async request => {
        try {
          await this.fetch(request);
        } finally {
          this.checkQueue();
        }
      }),
    );
  }

  private abort = (id?: string) => {
    if (id) {
      if (this.requests[id]) {
        this.requests[id].abort();
      }
      this.setState({
        [id]: {
          error: new AbortError(),
          fulfilled: false,
          pending: false,
          rejected: true,
          result: undefined,
          value: null,
        },
      });
    } else {
      const ids = [
        ...Object.keys(this.requests),
        ...this.props.requests.map(req => req.id),
      ];
      ids.map(id => {
        this.abort(id);
      });
    }
  };
}
