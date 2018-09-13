
// tslint:disable-next-line:no-implicit-dependencies
import { configure, shallow } from "enzyme";
// tslint:disable-next-line:no-implicit-dependencies
import * as Adapter from "enzyme-adapter-react-16";
import { readFileSync } from "fs";
import { createServer } from "http";
// tslint:disable-next-line:no-implicit-dependencies
import "jest";
import { join as pathJoin } from "path";
import * as React from "react";

import Fetchy, { IBag } from "../src";

const base = "http://localhost:8080";

configure({ adapter: new Adapter() });

describe("Fetchy", () => {
  let server;
  beforeAll((done) => {
    server = createServer((req, res) => {
      res.setHeader("Date", "Fake");

      switch (true) {
        case /^\/200/.test(req.url):
          res.setHeader("Content-Type", "application/json");
          res.write(JSON.stringify({
            headers: req.headers,
            url: req.url,
          }));
          res.end();
          break;
        case /^\/404/.test(req.url):
          res.statusCode = 404;
          res.write("404");
          res.end();
          break;
        case /^\/post\/200/.test(req.url):
          req.on("data", (data) => {
            console.log("data", data.toString());
          });
          res.end();
          break;
        default:
          res.write("ok");
          res.end();
          break;
      }
    });

    server.listen(8080, done);
  });
  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it("no render or children", () => {
    expect(() => shallow(<Fetchy />)).toThrow("Missing children or render props");
  });
  describe("basic", () => {
    it("render", () => {
      const render = jest.fn((bag: IBag) => {
        expect(bag).toMatchSnapshot();
      });
      shallow(<Fetchy render={render} />);
      expect(render).toHaveBeenCalled();
    });
    it("children", () => {
      const children = jest.fn((bag: IBag) => {
        expect(bag).toMatchSnapshot();
      });
      shallow(<Fetchy children={children} />);
      expect(children).toHaveBeenCalled();
    });
  });
  describe("fetch", () => {
    let bag;
    beforeEach(() => {
      const render = jest.fn((iBag: IBag) => {
        bag = iBag;
      });
      shallow(<Fetchy render={render} />);
      expect(render).toHaveBeenCalled();
      expect(bag).toMatchSnapshot();
    });

    it("GET 200", async () => {
      expect(await bag.fetch({
        headers: {
          "Some-Header": "1",
        },
        query: "foo",
        then: (value) => ({
          ...value,
          newValue: 1,
        }),
        url: `${base}/200`,
      })).toMatchSnapshot();
      expect(bag).toMatchSnapshot();
    });

    it("GET 404", async () => {
      expect.assertions(5);
      try {
        await bag.fetch({ url: `${base}/404` });
      } catch (e) {
        expect(e.data).toMatchSnapshot();
        expect(e).toMatchSnapshot();
      }
      expect(bag).toMatchSnapshot();
    });

    it("POST 200", async () => {
      expect(await bag.fetch({
        body: readFileSync(pathJoin(__dirname, "./fixtures/hello.txt")),
        url: `${base}/post/200`,
      })).toMatchSnapshot();
      expect(bag).toMatchSnapshot();
    });
  });
});