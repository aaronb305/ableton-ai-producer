{
	"patcher" : 	{
		"fileversion" : 1,
		"appversion" : 		{
			"major" : 8,
			"minor" : 6,
			"revision" : 0,
			"architecture" : "x64",
			"modernui" : 1
		},
		"classnamespace" : "box",
		"rect" : [ 0, 0, 900, 700 ],
		"bglocked" : 0,
		"openinpresentation" : 1,
		"default_fontsize" : 12.0,
		"default_fontface" : 0,
		"default_fontname" : "Arial",
		"gridonopen" : 1,
		"gridsize" : [ 15.0, 15.0 ],
		"gridsnaponopen" : 1,
		"objectsnaponopen" : 1,
		"statusbarvisible" : 2,
		"toolbarvisible" : 1,
		"lefttoolbarpinned" : 0,
		"toptoolbarpinned" : 0,
		"righttoolbarpinned" : 0,
		"bottomtoolbarpinned" : 0,
		"toolbars_unpinned_last_save" : 0,
		"tallnewobj" : 0,
		"boxanimatetime" : 200,
		"enablehscroll" : 1,
		"enablevscroll" : 1,
		"devicewidth" : 600,
		"description" : "AI-powered music production assistant",
		"digest" : "Claude-powered production assistant with chat, analysis, and sound library navigation",
		"tags" : "AI, Claude, production, assistant, chat",
		"style" : "",
		"subpatcher_template" : "",
		"assistshowspatchername" : 0,
		"boxes" : [
			{
				"box" : 				{
					"id" : "obj-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 300.0, 350.0, 22.0 ],
					"text" : "node.script ../node/index.js @autostart 1 @watch 1"
				}
			},
			{
				"box" : 				{
					"id" : "obj-jweb",
					"maxclass" : "jweb",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 30.0, 30.0, 580.0, 380.0 ],
					"presentation" : 1,
					"presentation_rect" : [ 0.0, 0.0, 600.0, 400.0 ],
					"url" : "../ui/index.html",
					"rendermode" : 0
				}
			},
			{
				"box" : 				{
					"id" : "obj-session-reader",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 300.0, 200.0, 22.0 ],
					"text" : "js ../patchers/session-reader.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-action-executor",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 370.0, 220.0, 22.0 ],
					"text" : "js ../patchers/action-executor.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-jweb",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 7,
					"outlettype" : [ "", "", "", "", "", "", "" ],
					"patching_rect" : [ 30.0, 120.0, 500.0, 22.0 ],
					"text" : "route chat set_api_key set_model set_depth clear_history request_session"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 6,
					"outlettype" : [ "", "", "", "", "", "" ],
					"patching_rect" : [ 30.0, 420.0, 480.0, 22.0 ],
					"text" : "route chat_response chat_done chat_error action_request token_usage"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-action-result",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 3,
					"outlettype" : [ "", "", "" ],
					"patching_rect" : [ 450.0, 440.0, 280.0, 22.0 ],
					"text" : "route action_result action_error"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-session",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 2,
					"outlettype" : [ "", "" ],
					"patching_rect" : [ 450.0, 340.0, 180.0, 22.0 ],
					"text" : "route session_state"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-chat",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 30.0, 170.0, 100.0, 22.0 ],
					"text" : "prepend chat"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-apikey",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 120.0, 170.0, 120.0, 22.0 ],
					"text" : "prepend set_api_key"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-model",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 250.0, 170.0, 120.0, 22.0 ],
					"text" : "prepend set_model"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-depth",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"text" : "prepend set_depth",
					"patching_rect" : [ 360.0, 170.0, 120.0, 22.0 ]
				}
			},
			{
				"box" : 				{
					"id" : "obj-clear",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 470.0, 170.0, 130.0, 22.0 ],
					"text" : "prepend clear_history"
				}
			},
			{
				"box" : 				{
					"id" : "obj-trigger-session",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 530.0, 170.0, 60.0, 22.0 ],
					"text" : "t bang"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-ar",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 480.0, 130.0, 22.0 ],
					"text" : "prepend action_result"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-session-node",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 450.0, 510.0, 140.0, 22.0 ],
					"text" : "prepend session_state"
				}
			},
			{
				"box" : 				{
					"id" : "obj-to-jweb-response",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 30.0, 470.0, 140.0, 22.0 ],
					"text" : "prepend chat_response"
				}
			},
			{
				"box" : 				{
					"id" : "obj-to-jweb-done",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 100.0, 470.0, 100.0, 22.0 ],
					"text" : "prepend chat_done"
				}
			},
			{
				"box" : 				{
					"id" : "obj-to-jweb-error",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 190.0, 470.0, 100.0, 22.0 ],
					"text" : "prepend chat_error"
				}
			},
			{
				"box" : 				{
					"id" : "obj-to-jweb-tokens",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 380.0, 470.0, 120.0, 22.0 ],
					"text" : "prepend token_usage"
				}
			},
			{
				"box" : 				{
					"id" : "obj-comment-title",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 550.0, 400.0, 20.0 ],
					"text" : "Ableton AI Producer — Message routing between jweb, node.script, and js objects"
				}
			},
			{
				"box" : 				{
					"id" : "obj-comment-flow1",
					"maxclass" : "comment",
					"numinlets" : 1,
					"numoutlets" : 0,
					"patching_rect" : [ 30.0, 570.0, 600.0, 20.0 ],
					"text" : "Flow: jweb (user input) → route → node.script (Claude API) → route → jweb (display) + js (Ableton actions)"
				}
			},
			{
				"box" : 				{
					"id" : "obj-loadbang",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 550.0, 260.0, 60.0, 22.0 ],
					"text" : "loadbang"
				}
			},
			{
				"box" : 				{
					"id" : "obj-delay-init",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 550.0, 280.0, 70.0, 22.0 ],
					"text" : "delay 3000"
				}
			},
			{
				"box" : 				{
					"id" : "obj-library-indexer",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 700.0, 300.0, 220.0, 22.0 ],
					"text" : "js ../patchers/library-indexer.js"
				}
			},
			{
				"box" : 				{
					"id" : "obj-route-library",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 4,
					"outlettype" : [ "", "", "", "" ],
					"patching_rect" : [ 700.0, 340.0, 280.0, 22.0 ],
					"text" : "route library_index scan_progress scan_error"
				}
			},
			{
				"box" : 				{
					"id" : "obj-prepend-library-index",
					"maxclass" : "newobj",
					"numinlets" : 1,
					"numoutlets" : 1,
					"outlettype" : [ "" ],
					"patching_rect" : [ 700.0, 380.0, 140.0, 22.0 ],
					"text" : "prepend library_index"
				}
			},
			{
				"box" : 				{
					"id" : "obj-delay-scan",
					"maxclass" : "newobj",
					"numinlets" : 2,
					"numoutlets" : 1,
					"outlettype" : [ "bang" ],
					"patching_rect" : [ 700.0, 280.0, 70.0, 22.0 ],
					"text" : "delay 5000"
				}
			}
		],
		"lines" : [
			{
				"patchline" : 				{
					"source" : [ "obj-jweb", 0 ],
					"destination" : [ "obj-route-jweb", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 0 ],
					"destination" : [ "obj-prepend-chat", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 1 ],
					"destination" : [ "obj-prepend-apikey", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 2 ],
					"destination" : [ "obj-prepend-model", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 3 ],
					"destination" : [ "obj-prepend-depth", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 4 ],
					"destination" : [ "obj-clear", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-jweb", 5 ],
					"destination" : [ "obj-trigger-session", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-chat", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-apikey", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-model", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-depth", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-clear", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-trigger-session", 0 ],
					"destination" : [ "obj-session-reader", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-session-reader", 0 ],
					"destination" : [ "obj-route-session", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-session", 0 ],
					"destination" : [ "obj-prepend-session-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-session-node", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-node", 0 ],
					"destination" : [ "obj-route-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 0 ],
					"destination" : [ "obj-to-jweb-response", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 1 ],
					"destination" : [ "obj-to-jweb-done", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 2 ],
					"destination" : [ "obj-to-jweb-error", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 3 ],
					"destination" : [ "obj-action-executor", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-node", 4 ],
					"destination" : [ "obj-to-jweb-tokens", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-to-jweb-response", 0 ],
					"destination" : [ "obj-jweb", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-to-jweb-done", 0 ],
					"destination" : [ "obj-jweb", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-to-jweb-error", 0 ],
					"destination" : [ "obj-jweb", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-to-jweb-tokens", 0 ],
					"destination" : [ "obj-jweb", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-action-executor", 0 ],
					"destination" : [ "obj-route-action-result", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-action-result", 0 ],
					"destination" : [ "obj-prepend-ar", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-ar", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loadbang", 0 ],
					"destination" : [ "obj-delay-init", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-delay-init", 0 ],
					"destination" : [ "obj-session-reader", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-loadbang", 0 ],
					"destination" : [ "obj-delay-scan", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-delay-scan", 0 ],
					"destination" : [ "obj-library-indexer", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-library-indexer", 0 ],
					"destination" : [ "obj-route-library", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-route-library", 0 ],
					"destination" : [ "obj-prepend-library-index", 0 ]
				}
			},
			{
				"patchline" : 				{
					"source" : [ "obj-prepend-library-index", 0 ],
					"destination" : [ "obj-node", 0 ]
				}
			}
		]
	}
}
